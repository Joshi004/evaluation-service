"""Eval run listing, submit, and cancel.

Streaming a run's logs belongs to Phase 6 -- this phase is submit plus
read plus cancel.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import runs as runs_controller
from app.db import get_db
from app.schemas.runs import CreateRunsRequest, RunListItem, RunSubmission
from app.services.runs.submit import SubmitValidationError
from app.services.runs.worker import RunNotCancellableError

router = APIRouter()


@router.get("", response_model=list[RunListItem])
async def list_runs(
    status: str | None = None,
    run_group_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[RunListItem]:
    return await runs_controller.list_runs(db, status, run_group_id)


@router.post("", response_model=RunSubmission, status_code=202)
async def submit_runs(
    request: CreateRunsRequest, db: AsyncSession = Depends(get_db)
) -> RunSubmission:
    """202: this returns as soon as the eval_run rows are queued and
    their workers started, not when the runs finish (Trap T3) -- each
    worker keeps running in the background after this response is sent.
    """
    try:
        submission = await runs_controller.submit_runs(db, request)
    except SubmitValidationError as exc:
        # 400: a request that cannot do what it says, caught before a
        # cold start rather than six minutes into one.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if submission is None:
        raise HTTPException(status_code=404, detail="Checkpoint or recipe not found")
    return submission


@router.post("/{run_id}/cancel", response_model=RunListItem)
async def cancel_run(run_id: int, db: AsyncSession = Depends(get_db)) -> RunListItem:
    try:
        run = await runs_controller.cancel_run(db, run_id)
    except RunNotCancellableError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
