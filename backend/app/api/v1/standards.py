"""Standards endpoints: list every reviewed recipe (`label IS NOT NULL`),
and trigger a rescan of STANDARDS_DIR without restarting the API.

Re-added in Phase 2 -- deleted in Phase 1 pending a real handler.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import standards as standards_controller
from app.db import get_db
from app.schemas.standards import StandardRecipe

router = APIRouter()


@router.get("", response_model=list[StandardRecipe])
async def list_standards(db: AsyncSession = Depends(get_db)) -> list[StandardRecipe]:
    return await standards_controller.list_standards(db)


@router.post("/reload", response_model=list[StandardRecipe])
async def reload_standards(db: AsyncSession = Depends(get_db)) -> list[StandardRecipe]:
    """Re-scan STANDARDS_DIR and load anything new. Safe to call any
    time: unchanged files re-find their existing hash and do nothing.
    """
    return await standards_controller.reload_standards(db)
