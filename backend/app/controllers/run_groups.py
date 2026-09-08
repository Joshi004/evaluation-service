"""Run-group controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.runs import RunGroupCancellation
from app.services.runs import worker


async def cancel_run_group(db: AsyncSession, run_group_id: int) -> RunGroupCancellation | None:
    """None means the router 404s -- the group itself doesn't exist."""
    return await worker.cancel_run_group(db, run_group_id)
