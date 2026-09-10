"""Standards endpoints: list every reviewed recipe (`label IS NOT NULL`),
trigger a rescan of `catalog/standards/` without restarting the API, and
preview what a reload would do (Phase 1).

Re-added in Phase 2 -- deleted in Phase 1 (of CHECKPOINT_REGISTRATION_PHASES.md)
pending a real handler.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import standards as standards_controller
from app.db import get_db
from app.schemas.catalog import CatalogStatus
from app.schemas.standards import StandardRecipe

router = APIRouter()


@router.get("", response_model=list[StandardRecipe])
async def list_standards(db: AsyncSession = Depends(get_db)) -> list[StandardRecipe]:
    return await standards_controller.list_standards(db)


@router.post("/reload", response_model=list[StandardRecipe])
async def reload_standards(db: AsyncSession = Depends(get_db)) -> list[StandardRecipe]:
    """Re-scan `catalog/standards/` and load anything new. Safe to call
    any time: unchanged files re-find their existing hash and do
    nothing.
    """
    return await standards_controller.reload_standards(db)


@router.get("/catalog-status", response_model=CatalogStatus)
async def get_standards_catalog_status(db: AsyncSession = Depends(get_db)) -> CatalogStatus:
    """What a `POST /reload` would do to every file, plus every row a
    reload would leave untouched -- a dry run, so it's a `GET` (S-D16).
    """
    return await standards_controller.get_catalog_status(db)
