"""Eval run and run group queries -- the only DB access for the runs
resource (app.api.v1.runs -> app.controllers.runs -> here), per
.cursor/rules/backend-layering.mdc. Used directly by app.services.runs.submit
and app.services.runs.worker too -- per the same convention
app.services.recipes.queries already follows, a library module reusing
another library module's DB access is normal composition, and it keeps
every query against these two tables in one file.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint, EvalRun, Recipe, RunGroup, ServingProfile
from app.schemas.runs import RunListItem

_ACTIVE_STATUSES = ("queued", "running")


async def list_runs(
    db: AsyncSession, status: str | None, run_group_id: int | None
) -> list[RunListItem]:
    """Eval runs, most recent first, optionally filtered by status
    and/or run group.
    """
    stmt = select(EvalRun).order_by(EvalRun.created_at.desc())
    if status is not None:
        stmt = stmt.where(EvalRun.status == status)
    if run_group_id is not None:
        stmt = stmt.where(EvalRun.run_group_id == run_group_id)

    runs = (await db.execute(stmt)).scalars().all()
    return [
        RunListItem(
            id=run.id,
            run_group_id=run.run_group_id,
            checkpoint_id=run.checkpoint_id,
            recipe_id=run.recipe_id,
            endpoint_id=run.endpoint_id,
            status=run.status,
            truncation_rate=run.truncation_rate,
            error=run.error,
            submitted_by=run.submitted_by,
            created_at=run.created_at,
            started_at=run.started_at,
            finished_at=run.finished_at,
        )
        for run in runs
    ]


async def create_run_group(db: AsyncSession, name: str, submitted_by: str | None) -> RunGroup:
    """One run_group per submit, always -- even a single run gets one
    (docs/IMPLEMENTATION_PHASES.md Phase 5, item 1): branching on whether
    there is one is more code than always creating one.
    """
    run_group = RunGroup(name=name, submitted_by=submitted_by)
    db.add(run_group)
    await db.flush()  # populates run_group.id via Postgres RETURNING
    await db.commit()
    return run_group


async def insert_eval_runs(
    db: AsyncSession,
    run_group_id: int,
    checkpoint_and_recipe_ids: list[tuple[int, int]],
    submitted_by: str | None,
) -> list[int]:
    """One queued eval_run per (checkpoint_id, recipe_id) pair -- the
    cartesian product submit.py already built and validated. A plain
    insert, committed once for the whole batch.
    """
    runs = [
        EvalRun(
            run_group_id=run_group_id,
            checkpoint_id=checkpoint_id,
            recipe_id=recipe_id,
            status="queued",
            submitted_by=submitted_by,
        )
        for checkpoint_id, recipe_id in checkpoint_and_recipe_ids
    ]
    db.add_all(runs)
    await db.flush()  # populates each run.id via Postgres RETURNING
    await db.commit()
    return [run.id for run in runs]


@dataclass
class RunContext:
    """The ORM rows worker._run_one needs before it does anything slow,
    fetched once in one query.
    """

    eval_run: EvalRun
    checkpoint: Checkpoint
    recipe: Recipe
    serving_profile: ServingProfile


async def load_run_context(db: AsyncSession, eval_run_id: int) -> RunContext | None:
    """Joins eval_run to everything the worker's pipeline needs, then
    commits to close the read transaction (Trap T2) before the worker
    does anything slow -- the ~350s cold start and the harness run that
    follow must never happen with a transaction still open underneath
    them.
    """
    stmt = (
        select(EvalRun, Checkpoint, Recipe, ServingProfile)
        .join(Checkpoint, EvalRun.checkpoint_id == Checkpoint.id)
        .join(Recipe, EvalRun.recipe_id == Recipe.id)
        .join(ServingProfile, Checkpoint.serving_profile_id == ServingProfile.id)
        .where(EvalRun.id == eval_run_id)
    )
    row = (await db.execute(stmt)).first()
    await db.commit()
    if row is None:
        return None
    eval_run, checkpoint, recipe, serving_profile = row
    return RunContext(
        eval_run=eval_run, checkpoint=checkpoint, recipe=recipe, serving_profile=serving_profile
    )


async def mark_running(db: AsyncSession, eval_run_id: int) -> EvalRun | None:
    eval_run = await db.get(EvalRun, eval_run_id)
    if eval_run is None:
        return None
    eval_run.status = "running"
    eval_run.started_at = datetime.now(UTC)
    await db.commit()
    return eval_run


async def attach_endpoint(db: AsyncSession, eval_run_id: int, endpoint_id: int) -> EvalRun | None:
    eval_run = await db.get(EvalRun, eval_run_id)
    if eval_run is None:
        return None
    eval_run.endpoint_id = endpoint_id
    await db.commit()
    return eval_run


async def mark_done(db: AsyncSession, eval_run_id: int) -> EvalRun | None:
    """The last write of a successful run (see worker.py) -- status only
    flips to 'done' after record_harness_result and insert_metrics have
    already landed, so the leaderboard query (status='done' joined to a
    primary metric) can never observe a done row with no number yet.
    """
    eval_run = await db.get(EvalRun, eval_run_id)
    if eval_run is None:
        return None
    eval_run.status = "done"
    eval_run.finished_at = datetime.now(UTC)
    await db.commit()
    return eval_run


async def mark_failed(db: AsyncSession, eval_run_id: int, error: str) -> EvalRun | None:
    """`error` is the reason, not the word "failed" (Trap T5) -- the
    difference between a five-minute diagnosis and an SSH session.
    """
    eval_run = await db.get(EvalRun, eval_run_id)
    if eval_run is None:
        return None
    eval_run.status = "failed"
    eval_run.error = error
    eval_run.finished_at = datetime.now(UTC)
    await db.commit()
    return eval_run


async def mark_cancelled(db: AsyncSession, eval_run_id: int) -> EvalRun | None:
    eval_run = await db.get(EvalRun, eval_run_id)
    if eval_run is None:
        return None
    eval_run.status = "cancelled"
    eval_run.finished_at = datetime.now(UTC)
    await db.commit()
    return eval_run


async def get_run(db: AsyncSession, eval_run_id: int) -> EvalRun | None:
    return await db.get(EvalRun, eval_run_id)


async def get_run_group(db: AsyncSession, run_group_id: int) -> RunGroup | None:
    return await db.get(RunGroup, run_group_id)


async def count_active_runs_on_endpoint(db: AsyncSession, endpoint_id: int) -> int:
    """How many runs still consider this endpoint theirs -- queued or
    running, i.e. not yet in a terminal state. Cancel (Trap T4) only
    kills the endpoint once this reaches zero, so cancelling one run in a
    group that shares an endpoint with a still-running sibling doesn't
    take the sibling's server out from under it.
    """
    stmt = select(func.count()).where(
        EvalRun.endpoint_id == endpoint_id, EvalRun.status.in_(_ACTIVE_STATUSES)
    )
    return (await db.execute(stmt)).scalar_one()


async def list_cancellable_run_ids(db: AsyncSession, run_group_id: int) -> list[int]:
    """Every run in this group not already in a terminal state -- what a
    group cancel loops over.
    """
    stmt = select(EvalRun.id).where(
        EvalRun.run_group_id == run_group_id, EvalRun.status.in_(_ACTIVE_STATUSES)
    )
    return list((await db.execute(stmt)).scalars().all())
