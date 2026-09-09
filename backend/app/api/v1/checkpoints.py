"""Checkpoint registry endpoints: list every checkpoint, one detail with
its runs, and (Phase 2) the two discovery routes for browsing and
inspecting candidates on the cluster that are not yet registered.
Nothing here writes to the database.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import checkpoints as checkpoints_controller
from app.db import get_db
from app.schemas.checkpoints import CheckpointDetail, CheckpointListItem
from app.schemas.discovery import (
    CheckpointCandidate,
    CheckpointInspection,
    InspectCheckpointRequest,
)
from app.services.cluster.ports import ClusterUnreachableError
from app.services.discovery.references import InvalidReferenceError

router = APIRouter()


@router.get("", response_model=list[CheckpointListItem])
async def list_checkpoints(db: AsyncSession = Depends(get_db)) -> list[CheckpointListItem]:
    return await checkpoints_controller.list_checkpoints(db)


@router.get("/candidates", response_model=list[CheckpointCandidate])
async def list_checkpoint_candidates(
    db: AsyncSession = Depends(get_db),
) -> list[CheckpointCandidate]:
    """Declared above `/{checkpoint_id}` (R-T5): FastAPI matches routes
    in declaration order, and the `int` path converter below would
    otherwise turn a request for this literal path into a 422.
    """
    try:
        return await checkpoints_controller.list_checkpoint_candidates(db)
    except ClusterUnreachableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/candidates/inspect", response_model=CheckpointInspection)
async def inspect_checkpoint_candidate(request: InspectCheckpointRequest) -> CheckpointInspection:
    """A POST, not a GET (R-D13): a reference does not URL-encode
    cleanly as a path segment, and inspection does real remote work --
    the server chooses the commands, and the reference is validated
    against the configured root before it reaches one.
    """
    try:
        return await checkpoints_controller.inspect_checkpoint_candidate(request.reference)
    except InvalidReferenceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ClusterUnreachableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/{checkpoint_id}", response_model=CheckpointDetail)
async def get_checkpoint(
    checkpoint_id: int, db: AsyncSession = Depends(get_db)
) -> CheckpointDetail:
    checkpoint = await checkpoints_controller.get_checkpoint(db, checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return checkpoint
