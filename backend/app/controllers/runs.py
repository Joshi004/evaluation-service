"""Eval run controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.runs import (
    CreateRunsRequest,
    RunDetail,
    RunListItem,
    RunPreview,
    RunPreviewRequest,
    RunSubmission,
)
from app.services.diagnostics import report_summary
from app.services.runs import preview as preview_service
from app.services.runs import queries as runs_service
from app.services.runs import submit as submit_service
from app.services.runs import worker
from app.services.standards import queries as standards_service


async def list_runs(
    db: AsyncSession, status: str | None, run_group_id: int | None
) -> list[RunListItem]:
    return await runs_service.list_runs(db, status, run_group_id)


async def submit_runs(db: AsyncSession, request: CreateRunsRequest) -> RunSubmission | None:
    """None means a checkpoint_id, standard_id, or explicit
    sampling_profile_id in the request doesn't exist -- the router 404s.
    submit.SubmitValidationError propagates past this unchanged for the
    router to map to 400.

    Spawning each run's background worker happens here, after the rows
    are safely committed -- the orchestration step between "create the
    submit service's rows" and "hand the response back", which is what a
    controller is for (.cursor/rules/backend-layering.mdc). The router
    that calls this only ever returns once this function does, so a run
    is never queued without its worker having been started.
    """
    submission = await submit_service.submit_runs(
        db,
        name=request.name,
        checkpoint_ids=request.checkpoint_ids,
        standard_ids=request.standard_ids,
        standard_overrides_by_standard_id={
            standard_id: overrides.model_dump(exclude_unset=True)
            for standard_id, overrides in request.standard_overrides_by_standard_id.items()
        },
        sampling_overrides_by_checkpoint_id={
            checkpoint_id: overrides.model_dump(exclude_unset=True)
            for checkpoint_id, overrides in request.sampling_overrides_by_checkpoint_id.items()
        },
        sampling_profile_id_by_checkpoint_id=request.sampling_profile_id_by_checkpoint_id,
        serving_overrides_by_checkpoint_id={
            checkpoint_id: overrides.model_dump(exclude_unset=True)
            for checkpoint_id, overrides in request.serving_overrides_by_checkpoint_id.items()
        },
        serving_profile_id_by_checkpoint_id=request.serving_profile_id_by_checkpoint_id,
        standard_label_by_standard_id=request.standard_label_by_standard_id,
        sampling_label_by_checkpoint_id=request.sampling_label_by_checkpoint_id,
        serving_label_by_checkpoint_id=request.serving_label_by_checkpoint_id,
        submitted_by=request.submitted_by,
    )
    if submission is None:
        return None

    for run_id in submission.run_ids:
        worker.spawn_run_worker(run_id)

    return submission


async def preview_runs(db: AsyncSession, request: RunPreviewRequest) -> RunPreview | None:
    """None means a checkpoint_id, standard_id, or explicit
    sampling_profile_id in the request doesn't exist -- the router
    404s, same as submit_runs. Never spawns anything: a preview has no
    worker to start.
    """
    return await preview_service.preview_runs(
        db,
        checkpoint_ids=request.checkpoint_ids,
        standard_ids=request.standard_ids,
        standard_overrides_by_standard_id={
            standard_id: overrides.model_dump(exclude_unset=True)
            for standard_id, overrides in request.standard_overrides_by_standard_id.items()
        },
        sampling_overrides_by_checkpoint_id={
            checkpoint_id: overrides.model_dump(exclude_unset=True)
            for checkpoint_id, overrides in request.sampling_overrides_by_checkpoint_id.items()
        },
        sampling_profile_id_by_checkpoint_id=request.sampling_profile_id_by_checkpoint_id,
        serving_overrides_by_checkpoint_id={
            checkpoint_id: overrides.model_dump(exclude_unset=True)
            for checkpoint_id, overrides in request.serving_overrides_by_checkpoint_id.items()
        },
        serving_profile_id_by_checkpoint_id=request.serving_profile_id_by_checkpoint_id,
    )


async def get_run(db: AsyncSession, eval_run_id: int) -> RunDetail | None:
    """Enriches RunDetail with a `performance` block computed from
    results_json -- kept here rather than inside runs_service's own
    get_run_detail, since summarize_run_performance is diagnostics-
    package logic (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 1),
    not a runs query.
    """
    run_detail = await runs_service.get_run_detail(db, eval_run_id)
    if run_detail is None:
        return None

    eval_run = await runs_service.get_run(db, eval_run_id)
    assert eval_run is not None  # get_run_detail above just found this row

    standard = await standards_service.get_standard(db, run_detail.standard_id)
    assert standard is not None  # eval_run.standard_id is a NOT NULL foreign key

    run_detail.performance = report_summary.summarize_run_performance(
        eval_run.results_json, standard.metrics, run_detail.metrics
    )
    return run_detail


async def run_exists(db: AsyncSession, eval_run_id: int) -> bool:
    """Just existence -- the log-stream router uses this to 404 before
    opening an SSE response, without needing the full enriched row (see
    app/api/v1/runs.py and services/runs/logs.py).
    """
    return await runs_service.get_run(db, eval_run_id) is not None


async def cancel_run(db: AsyncSession, eval_run_id: int) -> RunListItem | None:
    """None means the router 404s. worker.RunNotCancellableError
    propagates past this unchanged for the router to map to 409.
    """
    cancelled = await worker.cancel_run(db, eval_run_id)
    if cancelled is None:
        return None
    run_list_item = await runs_service.get_run_list_item(db, eval_run_id)
    assert run_list_item is not None  # cancel_run above just found this same row
    return run_list_item
