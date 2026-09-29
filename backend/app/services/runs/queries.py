"""Eval run and run group queries -- the only DB access for the runs
resource (app.api.v1.runs -> app.controllers.runs -> here), per
.cursor/rules/backend-layering.mdc. Used directly by app.services.runs.submit
and app.services.runs.worker too -- per the same convention
app.services.standards.queries already follows, a library module reusing
another library module's DB access is normal composition, and it keeps
every query against these two tables in one file.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Checkpoint,
    Endpoint,
    EvalRun,
    Metric,
    RunGroup,
    SamplingProfile,
    ServingProfile,
    Standard,
)
from app.schemas.runs import (
    RunDetail,
    RunEndpointSummary,
    RunListFilters,
    RunListItem,
    RunMetric,
    RunSamplingDetail,
    RunStandardDetail,
)
from app.schemas.standards import SamplingFieldWarning
from app.services.diagnostics.report_summary import wilson_interval
from app.services.serving_profiles.queries import to_serving_profile_summary
from app.services.standards.capabilities import (
    SEED_NOT_APPLIED_WITH_REPEATS_MESSAGE,
    per_request_seed_applies,
    sampling_field_warnings,
)

_ACTIVE_STATUSES = ("queued", "running")

# One row of the shared list/detail SELECT below, positional and in the
# exact order the statement selects them -- both `list_runs` and
# `get_run_list_item` feed a row of this shape into `_to_run_list_item`,
# per that function's own parameter order.
_RunListRow = tuple[
    EvalRun,
    str,  # checkpoint_name
    str | None,  # standard_label
    str,  # standard_hash
    str,  # benchmark
    str,  # run_group_name
    str | None,  # sampling_profile_label
    str,  # sampling_profile_hash
    str | None,  # primary_metric_name
    float | None,  # primary_metric_value
    int | None,  # primary_metric_n_samples
]


def _run_list_item_statement() -> Select[_RunListRow]:
    """The one SELECT shared by `list_runs` and `get_run_list_item`, so
    the two can never drift onto a different column set -- previously
    two separate, positionally-fed selects that had to be kept in sync
    by hand (docs/UI_REDESIGN_PLAN.md Phase 3's own documented trap).

    LEFT JOINs the run's primary metric row (`Metric.is_primary`,
    scoped to this run via the `and_` rather than a second `WHERE`,
    which would turn the LEFT JOIN back into an inner one): a queued,
    running, failed or cancelled run has none, and this list must keep
    showing those rows, not silently drop them.
    """
    primary_metric_join_condition = and_(Metric.eval_run_id == EvalRun.id, Metric.is_primary)
    return (
        select(
            EvalRun,
            Checkpoint.name,
            Standard.label,
            Standard.hash,
            Standard.benchmark,
            RunGroup.name,
            SamplingProfile.label,
            SamplingProfile.hash,
            Metric.name,
            Metric.value,
            Metric.n_samples,
        )
        .join(Checkpoint, EvalRun.checkpoint_id == Checkpoint.id)
        .join(Standard, EvalRun.standard_id == Standard.id)
        .join(RunGroup, EvalRun.run_group_id == RunGroup.id)
        .join(SamplingProfile, EvalRun.sampling_profile_id == SamplingProfile.id)
        .outerjoin(Metric, primary_metric_join_condition)
    )


def _to_run_list_item(
    run: EvalRun,
    checkpoint_name: str,
    standard_label: str | None,
    standard_hash: str,
    benchmark: str,
    run_group_name: str,
    sampling_profile_label: str | None,
    sampling_profile_hash: str,
    primary_metric_name: str | None,
    primary_metric_value: float | None,
    primary_metric_n_samples: int | None,
) -> RunListItem:
    confidence_interval = (
        wilson_interval(primary_metric_value, primary_metric_n_samples)
        if primary_metric_value is not None and primary_metric_n_samples
        else None
    )
    return RunListItem(
        id=run.id,
        run_group_id=run.run_group_id,
        run_group_name=run_group_name,
        checkpoint_id=run.checkpoint_id,
        checkpoint_name=checkpoint_name,
        standard_id=run.standard_id,
        standard_label=standard_label,
        standard_hash=standard_hash,
        benchmark=benchmark,
        endpoint_id=run.endpoint_id,
        status=run.status,
        truncation_rate=run.truncation_rate,
        error=run.error,
        submitted_by=run.submitted_by,
        created_at=run.created_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
        comparison_hash=run.comparison_hash,
        sampling_profile_label=sampling_profile_label,
        sampling_profile_hash=sampling_profile_hash,
        primary_metric_name=primary_metric_name,
        primary_metric_value=primary_metric_value,
        primary_metric_n_samples=primary_metric_n_samples,
        primary_metric_confidence_interval=confidence_interval,
    )


async def list_runs(db: AsyncSession, filters: RunListFilters) -> list[RunListItem]:
    """Eval runs, most recent first, narrowed by whichever `filters`
    fields are set. Joins in checkpoint name, standard label/hash/
    benchmark, run group name, resolved sampling profile and primary
    metric -- the same join `get_run_list_item` below uses for one run
    (`_run_list_item_statement`), so the Runs list and a run's detail
    page can never show a different name or score for the same ids.
    """
    stmt = _run_list_item_statement().order_by(EvalRun.created_at.desc())
    if filters.status is not None:
        stmt = stmt.where(EvalRun.status == filters.status)
    if filters.run_group_id is not None:
        stmt = stmt.where(EvalRun.run_group_id == filters.run_group_id)
    if filters.checkpoint_id is not None:
        stmt = stmt.where(EvalRun.checkpoint_id == filters.checkpoint_id)
    if filters.standard_id is not None:
        stmt = stmt.where(EvalRun.standard_id == filters.standard_id)
    if filters.benchmark is not None:
        stmt = stmt.where(Standard.benchmark == filters.benchmark)
    if filters.comparison_hash is not None:
        stmt = stmt.where(EvalRun.comparison_hash == filters.comparison_hash)

    rows = (await db.execute(stmt)).all()
    return [_to_run_list_item(*row) for row in rows]


async def get_run_list_item(db: AsyncSession, eval_run_id: int) -> RunListItem | None:
    """The same enriched shape as list_runs, for one run -- cancel_run's
    response (controllers/runs.py) needs it too, not just the bare
    eval_run row worker.cancel_run returns.
    """
    stmt = _run_list_item_statement().where(EvalRun.id == eval_run_id)
    row = (await db.execute(stmt)).first()
    if row is None:
        return None
    return _to_run_list_item(*row)


def _to_run_standard_detail(standard: Standard) -> RunStandardDetail:
    """The resolved-standard half of a run's detail -- every protocol
    field that can affect the run's score. No warnings here (see
    RunStandardDetail's own docstring): a D4 warning is a sampling
    concern, computed on the resolved sampling profile instead.
    """
    return RunStandardDetail(
        id=standard.id,
        hash=standard.hash,
        label=standard.label,
        benchmark=standard.benchmark,
        framework=standard.framework,
        framework_image=standard.framework_image,
        task_name=standard.task_name,
        dataset_name=standard.dataset_name,
        dataset_revision=standard.dataset_revision,
        split=standard.split,
        train_split=standard.train_split,
        few_shot=standard.few_shot,
        prompt_template=standard.prompt_template,
        few_shot_prompt_template=standard.few_shot_prompt_template,
        extraction=standard.extraction,
        metrics=standard.metrics,
        repeats=standard.repeats,
        sample_limit=standard.sample_limit,
        think_handling=standard.think_handling,
        sampling_overrides=standard.sampling_overrides,
        subsets=standard.subsets,
        eval_batch_size=standard.eval_batch_size,
        request_timeout_seconds=standard.request_timeout_seconds,
        created_at=standard.created_at,
    )


def _to_run_sampling_detail(
    sampling_profile: SamplingProfile, framework: str, repeats: int
) -> RunSamplingDetail:
    """The resolved-sampling half of a run's detail -- every field that
    can affect how the model was asked to speak, plus decision D4's
    per-field warnings (the same sampling_field_warnings the Standards
    page and the Submit preview also use, so a run's own page never
    disagrees with either) and the seed/repeats warning
    (compatibility.rules.seed_not_applied_with_repeats' own run-page
    counterpart -- same message, same condition, so a finished run
    says exactly what its own submit-time preview already warned).
    """
    config = sampling_profile.as_hashable_dict()
    warnings = sampling_field_warnings(framework, config)
    if not per_request_seed_applies(repeats):
        warnings.append(
            SamplingFieldWarning(field="seed", message=SEED_NOT_APPLIED_WITH_REPEATS_MESSAGE)
        )
    return RunSamplingDetail(
        id=sampling_profile.id,
        hash=sampling_profile.hash,
        label=sampling_profile.label,
        temperature=sampling_profile.temperature,
        top_p=sampling_profile.top_p,
        top_k=sampling_profile.top_k,
        min_p=sampling_profile.min_p,
        presence_penalty=sampling_profile.presence_penalty,
        repetition_penalty=sampling_profile.repetition_penalty,
        max_tokens=sampling_profile.max_tokens,
        enable_thinking=sampling_profile.enable_thinking,
        seed=sampling_profile.seed,
        warnings=warnings,
    )


async def get_run_detail(db: AsyncSession, eval_run_id: int) -> RunDetail | None:
    """Everything the run detail page needs: the enriched row (shared
    with list_runs/get_run_list_item), the fully resolved standard,
    sampling profile and serving profile, the endpoint it ran against
    (None if it never got one -- Phase 5's known cancel-before-endpoint
    gap), and its metric rows.

    Seven small queries rather than one giant join: RunGroup, Standard,
    SamplingProfile, ServingProfile, and Metric each have their own
    multi-column shape a single flat SELECT would otherwise have to
    repeat once per metric row.
    """
    run_list_item = await get_run_list_item(db, eval_run_id)
    if run_list_item is None:
        return None

    eval_run = await db.get(EvalRun, eval_run_id)
    assert eval_run is not None  # get_run_list_item above just found this row

    # This run's own requested partition (per-run SLURM partition
    # selection) -- the run_group's column, not the endpoint's; see
    # RunDetail.partition's own docstring for how the two can differ.
    run_group = await db.get(RunGroup, eval_run.run_group_id)
    assert run_group is not None  # eval_run.run_group_id is a NOT NULL foreign key

    standard = await db.get(Standard, eval_run.standard_id)
    assert standard is not None  # eval_run.standard_id is a NOT NULL foreign key

    sampling_profile = await db.get(SamplingProfile, eval_run.sampling_profile_id)
    assert sampling_profile is not None  # eval_run.sampling_profile_id is a NOT NULL foreign key

    # The run's own recorded profile (S-T12), not
    # `checkpoint.default_serving_profile_id` -- the two can differ the
    # moment a submit ever picks a profile explicitly, and this page
    # must show what the run actually ran against.
    serving_profile = await db.get(ServingProfile, eval_run.serving_profile_id)
    assert serving_profile is not None  # eval_run.serving_profile_id is a NOT NULL foreign key

    endpoint_summary = None
    if eval_run.endpoint_id is not None:
        endpoint = await db.get(Endpoint, eval_run.endpoint_id)
        if endpoint is not None:
            endpoint_summary = RunEndpointSummary(
                id=endpoint.id,
                url=endpoint.url,
                slurm_job_id=endpoint.slurm_job_id,
                partition=endpoint.partition,
                expires_at=endpoint.expires_at,
            )

    metrics_stmt = select(Metric).where(Metric.eval_run_id == eval_run_id).order_by(Metric.name)
    metric_rows = (await db.execute(metrics_stmt)).scalars().all()

    return RunDetail(
        **run_list_item.model_dump(),
        output_dir=eval_run.output_dir,
        partition=run_group.partition,
        standard=_to_run_standard_detail(standard),
        sampling=_to_run_sampling_detail(sampling_profile, standard.framework, standard.repeats),
        serving=to_serving_profile_summary(serving_profile),
        endpoint=endpoint_summary,
        metrics=[
            RunMetric(name=m.name, value=m.value, n_samples=m.n_samples, is_primary=m.is_primary)
            for m in metric_rows
        ],
    )


async def create_run_group(
    db: AsyncSession, name: str, submitted_by: str | None, partition: str
) -> RunGroup:
    """One run_group per submit, always -- even a single run gets one
    (docs/IMPLEMENTATION_PHASES.md Phase 5, item 1): branching on whether
    there is one is more code than always creating one.

    `partition` is always a real value by the time it reaches here --
    the controller has already resolved a `None` request field to
    `Settings.slurm_partition` -- so every new row records an explicit
    choice, never NULL (per-run SLURM partition selection; NULL is
    reserved for rows that predate the column).
    """
    run_group = RunGroup(name=name, submitted_by=submitted_by, partition=partition)
    db.add(run_group)
    await db.flush()  # populates run_group.id via Postgres RETURNING
    await db.commit()
    return run_group


@dataclass
class QueuedEvalRun:
    """One cell of the submitted grid, fully resolved and ready to
    insert -- everything `insert_eval_runs` needs and nothing it has to
    look up again. `serving_profile_id` travels alongside the three
    resolved ids because `eval_run` records it as the truth of what a
    run actually ran against (S-D5), even though it isn't part of
    `comparison_hash`.
    """

    checkpoint_id: int
    standard_id: int
    sampling_profile_id: int
    serving_profile_id: int
    comparison_hash: str


async def insert_eval_runs(
    db: AsyncSession,
    run_group_id: int,
    queued_runs: list[QueuedEvalRun],
    submitted_by: str | None,
) -> list[int]:
    """One queued eval_run per resolved grid cell -- the cartesian
    product submit.py already built, validated, and resolved. A plain
    insert, committed once for the whole batch.
    """
    runs = [
        EvalRun(
            run_group_id=run_group_id,
            checkpoint_id=queued_run.checkpoint_id,
            standard_id=queued_run.standard_id,
            sampling_profile_id=queued_run.sampling_profile_id,
            serving_profile_id=queued_run.serving_profile_id,
            comparison_hash=queued_run.comparison_hash,
            status="queued",
            submitted_by=submitted_by,
        )
        for queued_run in queued_runs
    ]
    db.add_all(runs)
    await db.flush()  # populates each run.id via Postgres RETURNING
    await db.commit()
    return [run.id for run in runs]


@dataclass
class RunContext:
    """The ORM rows worker._run_one needs before it does anything slow,
    fetched once in one query.

    `partition` is `str | None` only because the column it comes from
    (`run_group.partition`) is nullable for a row that predates per-run
    SLURM partition selection -- every run_group created from this
    point on always has one (`create_run_group`'s own docstring). The
    worker asserts it's set before using it.
    """

    eval_run: EvalRun
    checkpoint: Checkpoint
    standard: Standard
    sampling_profile: SamplingProfile
    serving_profile: ServingProfile
    partition: str | None


async def load_run_context(db: AsyncSession, eval_run_id: int) -> RunContext | None:
    """Joins eval_run to everything the worker's pipeline needs, then
    commits to close the read transaction (Trap T2) before the worker
    does anything slow -- the ~350s cold start and the harness run that
    follow must never happen with a transaction still open underneath
    them.

    Joins serving_profile through `EvalRun.serving_profile_id`, not
    `Checkpoint.default_serving_profile_id` (S-T12): the run's own
    recorded column is the one the worker actually has to honour, and
    the two can differ the moment a submit ever picks a profile
    explicitly.
    """
    stmt = (
        select(EvalRun, Checkpoint, Standard, SamplingProfile, ServingProfile, RunGroup.partition)
        .join(Checkpoint, EvalRun.checkpoint_id == Checkpoint.id)
        .join(Standard, EvalRun.standard_id == Standard.id)
        .join(SamplingProfile, EvalRun.sampling_profile_id == SamplingProfile.id)
        .join(ServingProfile, EvalRun.serving_profile_id == ServingProfile.id)
        .join(RunGroup, EvalRun.run_group_id == RunGroup.id)
        .where(EvalRun.id == eval_run_id)
    )
    row = (await db.execute(stmt)).first()
    await db.commit()
    if row is None:
        return None
    eval_run, checkpoint, standard, sampling_profile, serving_profile, partition = row
    return RunContext(
        eval_run=eval_run,
        checkpoint=checkpoint,
        standard=standard,
        sampling_profile=sampling_profile,
        serving_profile=serving_profile,
        partition=partition,
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
