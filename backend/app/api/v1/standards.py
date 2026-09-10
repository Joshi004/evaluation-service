"""Standards endpoints: list every reviewed standard (`label IS NOT NULL`)
by default, or every standard -- reviewed and ad-hoc alike -- when
`include_ad_hoc=true`; trigger a rescan of `catalog/standards/` without
restarting the API; and preview what a reload would do (Phase 1).

`include_ad_hoc=true` is also what used to be a separate list-every-
hashed-row endpoint before docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3
folded it in here: one table, one list endpoint, distinguished by a
query parameter rather than by which route you called.

Re-added in Phase 2 -- deleted in Phase 1 (of CHECKPOINT_REGISTRATION_PHASES.md)
pending a real handler.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import standards as standards_controller
from app.db import get_db
from app.schemas.catalog import CatalogStatus
from app.schemas.standards import StandardSummary

router = APIRouter()


@router.get("", response_model=list[StandardSummary])
async def list_standards(
    include_ad_hoc: bool = False, db: AsyncSession = Depends(get_db)
) -> list[StandardSummary]:
    return await standards_controller.list_standards(db, include_ad_hoc=include_ad_hoc)


@router.post("/reload", response_model=list[StandardSummary])
async def reload_standards(db: AsyncSession = Depends(get_db)) -> list[StandardSummary]:
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
