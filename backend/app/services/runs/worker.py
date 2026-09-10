"""The per-run background pipeline (docs/IMPLEMENTATION_PHASES.md Phase
5, item 2) and cancel (item 4) -- grouped in one module because cancel
has to reach the same task registry and endpoint locks this module owns.

No reconciler and no state machine, deliberately: `spawn_run_worker` is
called once, directly from the controller behind `POST /runs`, and the
task it creates walks straight from `queued` to a terminal status with
no polling loop anywhere in between.
"""

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.models import EvalRun
from app.schemas.runs import RunGroupCancellation
from app.services.checkpoints import availability as availability_service
from app.services.endpoints import lifecycle
from app.services.harness import queries as harness_queries
from app.services.harness import runner as harness_runner
from app.services.harness.parser import compute_truncation_rate, parse_report
from app.services.runs import queries as runs_queries

logger = logging.getLogger(__name__)

# Strong references: the event loop only holds a weak one, so a task
# dropped from here could be garbage-collected mid-run. cancel_run looks
# a run's task up here by eval_run_id.
_running_workers: dict[int, asyncio.Task[None]] = {}

# Serialises endpoint acquisition per (checkpoint_id, serving_profile_id):
# two runs in one group starting together would both miss the reuse query
# and both sbatch a serve job, costing a whole extra H100 (Trap T1). An
# in-process Lock is enough only because v1 runs a single worker process;
# a second process would need SELECT ... FOR UPDATE instead.
_endpoint_locks: dict[tuple[int, int], asyncio.Lock] = {}

_TERMINAL_STATUSES = ("done", "failed", "cancelled")


def spawn_run_worker(eval_run_id: int) -> None:
    """Detaches one run's pipeline as its own asyncio task -- the '202
    means it returns immediately' contract (Trap T3). The task is
    registered before this function returns, so a cancel request that
    arrives moments later always finds it.
    """
    task = asyncio.create_task(_run_one(eval_run_id))
    _running_workers[eval_run_id] = task
    task.add_done_callback(lambda _task: _running_workers.pop(eval_run_id, None))


def _get_endpoint_lock(checkpoint_id: int, serving_profile_id: int) -> asyncio.Lock:
    key = (checkpoint_id, serving_profile_id)
    if key not in _endpoint_locks:
        _endpoint_locks[key] = asyncio.Lock()
    return _endpoint_locks[key]


async def _run_one(eval_run_id: int) -> None:
    """The straight-line pipeline: re-check the checkpoint's
    availability, reuse-or-start an endpoint, run the harness against
    it, parse the result, and persist it -- on one session held for the
    run's whole lifetime, with every query helper below committing
    immediately so no transaction is ever open across the ~350s cold
    start or the harness subprocess (Trap T2).
    """
    async with AsyncSessionLocal() as db:
        context = await runs_queries.load_run_context(db, eval_run_id)
        if context is None:
            logger.error("run %d vanished before its worker could start", eval_run_id)
            return

        await runs_queries.mark_running(db, eval_run_id)

        try:
            # R-D26: submit-time validation (compatibility/rules.py's
            # checkpoint_unavailable) already gave an immediate 400 for
            # a checkpoint known-unavailable then -- this is the check
            # that actually protects the GPUs, because a queued run can
            # sit long enough for that record to go stale. No
            # transaction is open here (load_run_context and
            # mark_running above both commit already, R-T22), and this
            # is inside the try so a cancellation raised mid-SSH-call
            # still reaches the CancelledError handler below rather than
            # a handler of its own (R-T23).
            availability = await availability_service.refresh_availability(db, context.checkpoint)
            if availability.status != "available":
                message = (
                    f"checkpoint {context.checkpoint.name!r} is not available "
                    f"({availability.status})"
                )
                if availability.detail:
                    message += f": {availability.detail}"
                logger.warning(
                    "run %d: checkpoint %d is not available (%s) -- failing before a serve "
                    "job is submitted",
                    eval_run_id,
                    context.checkpoint.id,
                    availability.status,
                )
                await runs_queries.mark_failed(db, eval_run_id, message)
                return

            lock = _get_endpoint_lock(context.checkpoint.id, context.serving_profile.id)
            async with lock:
                endpoint = await lifecycle.start_or_reuse_endpoint(
                    db, context.checkpoint, context.serving_profile
                )
            await runs_queries.attach_endpoint(db, eval_run_id, endpoint.id)

            await harness_runner.run_harness(
                context.standard,
                context.sampling_profile,
                context.checkpoint,
                endpoint,
                eval_run_id,
            )

            run_dir = harness_runner.run_directory(eval_run_id)
            # checkpoint.name, not a path reconstruction (Trap T3 of
            # Phase 4) -- it's what serve_job.py put in SERVED_NAME, so
            # it's the <model_tag> segment under both predictions/ and
            # reports/.
            served_model_name = context.checkpoint.name
            report = parse_report(run_dir, context.standard, served_model_name)
            truncation_rate = compute_truncation_rate(
                run_dir, context.standard, context.sampling_profile, served_model_name
            )

            await harness_queries.record_harness_result(
                db, eval_run_id, str(run_dir), report.results_json, truncation_rate
            )
            await harness_queries.insert_metrics(db, eval_run_id, report.metrics)

            # The last write, deliberately (queries.mark_done's own
            # docstring): the leaderboard's status='done' filter must
            # never observe a done row before its metric rows exist.
            await runs_queries.mark_done(db, eval_run_id)
        except asyncio.CancelledError:
            # cancel_run already wrote 'cancelled' before cancelling this
            # task -- nothing here should overwrite it.
            raise
        except Exception as exc:
            logger.exception("run %d failed", eval_run_id)
            # A prior write in this try block (e.g. insert_metrics
            # hitting its UniqueConstraint) can leave the session's
            # transaction aborted -- roll back before the next query, or
            # mark_failed's own db.get() would fail too.
            await db.rollback()
            await runs_queries.mark_failed(db, eval_run_id, f"{type(exc).__name__}: {exc}")


class RunNotCancellableError(Exception):
    """The run exists but is already in a terminal state -- the router
    turns this into a 409, since retrying the same cancel request could
    never succeed.
    """

    def __init__(self, eval_run_id: int, status: str) -> None:
        self.eval_run_id = eval_run_id
        self.status = status
        super().__init__(f"eval_run {eval_run_id} is already {status!r}, cannot cancel")


async def cancel_run(db: AsyncSession, eval_run_id: int) -> EvalRun | None:
    """Item 4's cancel. Writes 'cancelled' before touching the task or
    the container, so _run_one's own except-Exception handler can never
    race this write and overwrite it back to 'failed'.

    Known gap, accepted rather than solved here: a run cancelled while
    start_or_reuse_endpoint is still polling for readiness has no
    endpoint_id yet, so this cannot scancel its serve job -- it survives
    until --time expires. That is the same tradeoff startup recovery
    already accepts (item 3): every serve job's explicit --time is what
    bounds the damage, not this code path.
    """
    eval_run = await runs_queries.get_run(db, eval_run_id)
    if eval_run is None:
        return None
    if eval_run.status in _TERMINAL_STATUSES:
        raise RunNotCancellableError(eval_run_id, eval_run.status)

    cancelled = await runs_queries.mark_cancelled(db, eval_run_id)
    assert cancelled is not None  # just fetched above, in the same session

    task = _running_workers.get(eval_run_id)
    if task is not None:
        task.cancel()
    # Cancelling the task above does not stop the `docker run` child it
    # may have started -- that process keeps running, and keeps the
    # endpoint busy, unless killed separately.
    await harness_runner.kill_harness_container(eval_run_id)

    if cancelled.endpoint_id is not None:
        # Trap T4: only tear down the endpoint if this cancelled run was
        # its last active user -- a sibling run in the same group may
        # still be using it. Writing 'cancelled' above is what makes
        # this run stop counting itself.
        active_runs = await runs_queries.count_active_runs_on_endpoint(db, cancelled.endpoint_id)
        if active_runs == 0:
            await lifecycle.kill_endpoint(db, cancelled.endpoint_id)

    return cancelled


async def cancel_run_group(db: AsyncSession, run_group_id: int) -> RunGroupCancellation | None:
    """The group cancel (item 4) -- the same cancel_run, looped over
    every run in the group that isn't already terminal. A run that races
    to a terminal state between listing and cancelling is skipped rather
    than failing the whole group cancel.
    """
    run_group = await runs_queries.get_run_group(db, run_group_id)
    if run_group is None:
        return None

    cancellable_ids = await runs_queries.list_cancellable_run_ids(db, run_group_id)
    cancelled_ids: list[int] = []
    for eval_run_id in cancellable_ids:
        try:
            cancelled = await cancel_run(db, eval_run_id)
        except RunNotCancellableError:
            continue
        if cancelled is not None:
            cancelled_ids.append(cancelled.id)

    return RunGroupCancellation(run_group_id=run_group_id, cancelled_run_ids=cancelled_ids)
