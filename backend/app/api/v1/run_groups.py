"""Run-group cancellation: cancel every non-terminal run in a group at
once. See docs/IMPLEMENTATION_PHASES.md Phase 5, item 4.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import run_groups as run_groups_controller
from app.db import get_db
from app.schemas.runs import RunGroupCancellation

router = APIRouter()


@router.post("/{run_group_id}/cancel", response_model=RunGroupCancellation)
async def cancel_run_group(
    run_group_id: int, db: AsyncSession = Depends(get_db)
) -> RunGroupCancellation:
    cancellation = await run_groups_controller.cancel_run_group(db, run_group_id)
    if cancellation is None:
        raise HTTPException(status_code=404, detail="Run group not found")
    return cancellation
