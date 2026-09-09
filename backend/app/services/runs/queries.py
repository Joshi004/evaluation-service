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

from app.models import Checkpoint, Endpoint, EvalRun, Metric, Recipe, RunGroup, ServingProfile
from app.schemas.runs import (
    RunDetail,
    RunEndpointSummary,
    RunListItem,
    RunMetric,
    RunRecipeDetail,
)
from app.services.standards.capabilities import sampling_field_warnings

_ACTIVE_STATUSES = ("queued", "running")


def _to_run_list_item(
    run: EvalRun,
    checkpoint_name: str,
    recipe_label: str | None,
    recipe_hash: str,
    benchmark: str,
    run_group_name: str,
) -> RunListItem:
    return RunListItem(
        id=run.id,
        run_group_id=run.run_group_id,
        run_group_name=run_group_name,
        checkpoint_id=run.checkpoint_id,
        checkpoint_name=checkpoint_name,
        recipe_id=run.recipe_id,
        recipe_label=recipe_label,
        recipe_hash=recipe_hash,
        benchmark=benchmark,
        endpoint_id=run.endpoint_id,
        status=run.status,
        truncation_rate=run.truncation_rate,
        error=run.error,
        submitted_by=run.submitted_by,
        created_at=run.created_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
    )


async def list_runs(
    db: AsyncSession, status: str | None, run_group_id: int | None
) -> list[RunListItem]:
    """Eval runs, most recent first, optionally filtered by status
    and/or run group. Joins in checkpoint name, recipe label/hash/
    benchmark and run group name -- the same join get_run_list_item
    below uses for one run, so the Runs list and a run's detail page can
    never show a different name for the same ids.
    """
    stmt = (
        select(EvalRun, Checkpoint.name, Recipe.label, Recipe.hash, Recipe.benchmark, RunGroup.name)
        .join(Checkpoint, EvalRun.checkpoint_id == Checkpoint.id)
        .join(Recipe, EvalRun.recipe_id == Recipe.id)
        .join(RunGroup, EvalRun.run_group_id == RunGroup.id)
        .order_by(EvalRun.created_at.desc())
    )
    if status is not None:
        stmt = stmt.where(EvalRun.status == status)
    if run_group_id is not None:
        stmt = stmt.where(EvalRun.run_group_id == run_group_id)

    rows = (await db.execute(stmt)).all()
    return [_to_run_list_item(*row) for row in rows]


async def get_run_list_item(db: AsyncSession, eval_run_id: int) -> RunListItem | None:
    """The same enriched shape as list_runs, for one run -- cancel_run's
    response (controllers/runs.py) needs it too, not just the bare
    eval_run row worker.cancel_run returns.
    """
    stmt = (
        select(EvalRun, Checkpoint.name, Recipe.label, Recipe.hash, Recipe.benchmark, RunGroup.name)
        .join(Checkpoint, EvalRun.checkpoint_id == Checkpoint.id)
        .join(Recipe, EvalRun.recipe_id == Recipe.id)
        .join(RunGroup, EvalRun.run_group_id == RunGroup.id)
        .where(EvalRun.id == eval_run_id)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return None
    return _to_run_list_item(*row)


def _to_run_recipe_detail(recipe: Recipe) -> RunRecipeDetail:
    """The resolved-recipe half of a run's detail -- every field that
    can affect the run's score, plus decision D4's per-field warnings
    (the same sampling_field_warnings the Standards page and the Phase 6
    preview also use, so a run's own recipe page never disagrees with
    either).
    """
    config = recipe.as_hashable_dict()
    return RunRecipeDetail(
        id=recipe.id,
        hash=recipe.hash,
        label=recipe.label,
        benchmark=recipe.benchmark,
        framework=recipe.framework,
        framework_image=recipe.framework_image,
        task_name=recipe.task_name,
        dataset_name=recipe.dataset_name,
        dataset_revision=recipe.dataset_revision,
        split=recipe.split,
        few_shot=recipe.few_shot,
        prompt_template=recipe.prompt_template,
        extraction=recipe.extraction,
        metrics=recipe.metrics,
        repeats=recipe.repeats,
        sample_limit=recipe.sample_limit,
        temperature=recipe.temperature,
        top_p=recipe.top_p,
        top_k=recipe.top_k,
        min_p=recipe.min_p,
        presence_penalty=recipe.presence_penalty,
        repetition_penalty=recipe.repetition_penalty,
        max_tokens=recipe.max_tokens,
        enable_thinking=recipe.enable_thinking,
        think_handling=recipe.think_handling,
        created_at=recipe.created_at,
        warnings=sampling_field_warnings(recipe.framework, config),
    )


async def get_run_detail(db: AsyncSession, eval_run_id: int) -> RunDetail | None:
    """Everything the run detail page needs (Phase 6): the enriched row
    (shared with list_runs/get_run_list_item), the fully resolved
    recipe, the endpoint it ran against (None if it never got one --
    Phase 5's known cancel-before-endpoint gap), and its metric rows.

    Four small queries rather than one giant join: Recipe and Metric
    each have their own multi-column shape a single flat SELECT would
    otherwise have to repeat once per metric row.
    """
    run_list_item = await get_run_list_item(db, eval_run_id)
    if run_list_item is None:
        return None

    eval_run = await db.get(EvalRun, eval_run_id)
    assert eval_run is not None  # get_run_list_item above just found this row

    recipe = await db.get(Recipe, eval_run.recipe_id)
    assert recipe is not None  # eval_run.recipe_id is a NOT NULL foreign key

    endpoint_summary = None
    if eval_run.endpoint_id is not None:
        endpoint = await db.get(Endpoint, eval_run.endpoint_id)
        if endpoint is not None:
            endpoint_summary = RunEndpointSummary(
                id=endpoint.id,
                url=endpoint.url,
                slurm_job_id=endpoint.slurm_job_id,
                expires_at=endpoint.expires_at,
            )

    metrics_stmt = select(Metric).where(Metric.eval_run_id == eval_run_id).order_by(Metric.name)
    metric_rows = (await db.execute(metrics_stmt)).scalars().all()

    return RunDetail(
        **run_list_item.model_dump(),
        output_dir=eval_run.output_dir,
        recipe=_to_run_recipe_detail(recipe),
        endpoint=endpoint_summary,
        metrics=[
            RunMetric(name=m.name, value=m.value, n_samples=m.n_samples, is_primary=m.is_primary)
            for m in metric_rows
        ],
    )


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
        .join(ServingProfile, Checkpoint.default_serving_profile_id == ServingProfile.id)
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
