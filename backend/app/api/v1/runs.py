"""Eval run listing, with optional status / run-group filters.

Submitting a run and streaming its logs belong to a later phase -- this
phase is read-only.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import runs as runs_controller
from app.db import get_db
from app.schemas.runs import RunListItem

router = APIRouter()


@router.get("", response_model=list[RunListItem])
async def list_runs(
    status: str | None = None,
    run_group_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[RunListItem]:
    return await runs_controller.list_runs(db, status, run_group_id)
