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
from app.services.runs import preview as preview_service
from app.services.runs import queries as runs_service
from app.services.runs import submit as submit_service
from app.services.runs import worker


async def list_runs(
    db: AsyncSession, status: str | None, run_group_id: int | None
) -> list[RunListItem]:
    return await runs_service.list_runs(db, status, run_group_id)


async def submit_runs(db: AsyncSession, request: CreateRunsRequest) -> RunSubmission | None:
    """None means a checkpoint_id or recipe_id in the request doesn't
    exist -- the router 404s. submit.SubmitValidationError propagates
    past this unchanged for the router to map to 400.

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
        recipe_ids=request.recipe_ids,
        overrides=request.overrides.model_dump(exclude_unset=True),
        submitted_by=request.submitted_by,
    )
    if submission is None:
        return None

    for run_id in submission.run_ids:
        worker.spawn_run_worker(run_id)

    return submission


async def preview_runs(db: AsyncSession, request: RunPreviewRequest) -> RunPreview | None:
    """None means a checkpoint_id or recipe_id in the request doesn't
    exist -- the router 404s, same as submit_runs. Never spawns
    anything: a preview has no worker to start.
    """
    return await preview_service.preview_runs(
        db,
        checkpoint_ids=request.checkpoint_ids,
        recipe_ids=request.recipe_ids,
        overrides=request.overrides.model_dump(exclude_unset=True),
    )


async def get_run(db: AsyncSession, eval_run_id: int) -> RunDetail | None:
    return await runs_service.get_run_detail(db, eval_run_id)


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
