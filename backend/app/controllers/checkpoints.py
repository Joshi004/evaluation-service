"""Checkpoint controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.checkpoints import CheckpointDetail, CheckpointListItem
from app.services.checkpoints import queries as checkpoints_service


async def list_checkpoints(db: AsyncSession) -> list[CheckpointListItem]:
    return await checkpoints_service.list_checkpoints(db)


async def get_checkpoint(db: AsyncSession, checkpoint_id: int) -> CheckpointDetail | None:
    return await checkpoints_service.get_checkpoint_with_runs(db, checkpoint_id)
