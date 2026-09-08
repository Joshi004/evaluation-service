"""Eval run controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.runs import RunListItem
from app.services.runs import queries as runs_service


async def list_runs(
    db: AsyncSession, status: str | None, run_group_id: int | None
) -> list[RunListItem]:
    return await runs_service.list_runs(db, status, run_group_id)
