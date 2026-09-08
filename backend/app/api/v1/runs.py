"""Eval run listing, submit, preview, detail, cancel, and live logs.

Phase 5 built submit/list/cancel; Phase 6 adds the read-only preview,
the single-run detail, and SSE log streaming.
"""

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import runs as runs_controller
from app.db import get_db
from app.schemas.runs import (
    CreateRunsRequest,
    RunDetail,
    RunListItem,
    RunPreview,
    RunPreviewRequest,
    RunSubmission,
)
from app.services.runs.logs import LogSource, stream_log_events
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


@router.post("/preview", response_model=RunPreview)
async def preview_runs(
    request: RunPreviewRequest, db: AsyncSession = Depends(get_db)
) -> RunPreview:
    """Read-only: never mints a recipe row or creates a run_group. The
    Submit page calls this on every grid or override change, so unlike
    POST /runs above, a pair that cannot run is reported in the
    response's `blocking_error` rather than raised as a 400 -- a 3x6
    grid with one bad pair should still preview the other 17.
    """
    preview = await runs_controller.preview_runs(db, request)
    if preview is None:
        raise HTTPException(status_code=404, detail="Checkpoint or recipe not found")
    return preview


@router.get("/{run_id}", response_model=RunDetail)
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)) -> RunDetail:
    run = await runs_controller.get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/{run_id}/cancel", response_model=RunListItem)
async def cancel_run(run_id: int, db: AsyncSession = Depends(get_db)) -> RunListItem:
    try:
        run = await runs_controller.cancel_run(db, run_id)
    except RunNotCancellableError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/{run_id}/logs")
async def stream_run_logs(
    run_id: int,
    source: LogSource = "harness",
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Server-Sent Events, not WebSockets (docs/IMPLEMENTATION_PHASES.md
    Phase 6, item 4): the traffic is one-directional and SSE reconnects
    itself on its own, which a `tail -f`-backed connection benefits from
    more than most. `db` here is only for the existence check below --
    the stream itself never touches this request's session; see
    services/runs/logs.py's module docstring for why.
    """
    if not await runs_controller.run_exists(db, run_id):
        raise HTTPException(status_code=404, detail="Run not found")

    events: AsyncIterator[str] = stream_log_events(source, run_id)
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
