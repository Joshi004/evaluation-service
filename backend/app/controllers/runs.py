"""Eval run controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EvalRun
from app.schemas.runs import CreateRunsRequest, RunListItem, RunSubmission
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


async def cancel_run(db: AsyncSession, eval_run_id: int) -> RunListItem | None:
    """None means the router 404s. worker.RunNotCancellableError
    propagates past this unchanged for the router to map to 409.
    """
    eval_run = await worker.cancel_run(db, eval_run_id)
    if eval_run is None:
        return None
    return _to_run_list_item(eval_run)


def _to_run_list_item(run: EvalRun) -> RunListItem:
    return RunListItem(
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
