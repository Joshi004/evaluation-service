"""Checkpoint registry endpoints: list every checkpoint, one detail with
its runs, the two discovery routes for browsing and inspecting
candidates on the cluster (Phase 2), and (Phase 5) the write path --
registration and the standalone availability re-check.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import checkpoints as checkpoints_controller
from app.db import get_db
from app.schemas.checkpoints import (
    CheckpointDetail,
    CheckpointListItem,
    RegisterCheckpointRequest,
)
from app.schemas.discovery import (
    CheckpointCandidate,
    CheckpointInspection,
    InspectCheckpointRequest,
)
from app.services.checkpoints.registration import (
    CheckpointConflictError,
    RegistrationTargetNotFoundError,
    UnreadableCheckpointError,
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
async def inspect_checkpoint_candidate(
    request: InspectCheckpointRequest, db: AsyncSession = Depends(get_db)
) -> CheckpointInspection:
    """A POST, not a GET (R-D13): a reference does not URL-encode
    cleanly as a path segment, and inspection does real remote work --
    the server chooses the commands, and the reference is validated
    against the configured root before it reaches one.
    """
    try:
        return await checkpoints_controller.inspect_checkpoint_candidate(db, request.reference)
    except InvalidReferenceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ClusterUnreachableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("", response_model=CheckpointDetail, status_code=201)
async def register_checkpoint(
    request: RegisterCheckpointRequest, db: AsyncSession = Depends(get_db)
) -> CheckpointDetail:
    """201, not 202: the row exists and is returned in full -- inferred
    columns and all -- by the time this responds, unlike POST /runs'
    202, which queues work that keeps running after the response.
    """
    try:
        return await checkpoints_controller.register_checkpoint(db, request)
    except InvalidReferenceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UnreadableCheckpointError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RegistrationTargetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CheckpointConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ClusterUnreachableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/{checkpoint_id}/validate", response_model=CheckpointDetail)
async def validate_checkpoint(
    checkpoint_id: int, db: AsyncSession = Depends(get_db)
) -> CheckpointDetail:
    """Re-checks the weights behind an already-registered checkpoint and
    writes only the availability columns (R-D1) -- it never deletes the
    row, whatever the result.
    """
    try:
        checkpoint = await checkpoints_controller.check_checkpoint_availability(db, checkpoint_id)
    except ClusterUnreachableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return checkpoint


@router.get("/{checkpoint_id}", response_model=CheckpointDetail)
async def get_checkpoint(
    checkpoint_id: int, db: AsyncSession = Depends(get_db)
) -> CheckpointDetail:
    checkpoint = await checkpoints_controller.get_checkpoint(db, checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return checkpoint
