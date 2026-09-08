"""Checkpoint registry endpoints: list every checkpoint, and one detail
with its runs.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import checkpoints as checkpoints_controller
from app.db import get_db
from app.schemas.checkpoints import CheckpointDetail, CheckpointListItem

router = APIRouter()


@router.get("", response_model=list[CheckpointListItem])
async def list_checkpoints(db: AsyncSession = Depends(get_db)) -> list[CheckpointListItem]:
    return await checkpoints_controller.list_checkpoints(db)


@router.get("/{checkpoint_id}", response_model=CheckpointDetail)
async def get_checkpoint(
    checkpoint_id: int, db: AsyncSession = Depends(get_db)
) -> CheckpointDetail:
    checkpoint = await checkpoints_controller.get_checkpoint(db, checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return checkpoint
