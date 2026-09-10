"""Sampling-profile endpoints: list every profile, labelled catalog
entries and ad-hoc customisations alike (Phase 3+ mints the latter);
rescan `catalog/sampling-profiles/` and preview what a reload would do.
See docs/STANDARDS_AND_PROFILES_PHASES.md Phase 2, item 9 -- a direct
mirror of app/api/v1/serving_profiles.py, one catalog over.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import sampling_profiles as sampling_profiles_controller
from app.db import get_db
from app.schemas.catalog import CatalogStatus
from app.schemas.sampling_profiles import SamplingProfileSummary

router = APIRouter()


@router.get("", response_model=list[SamplingProfileSummary])
async def list_sampling_profiles(
    db: AsyncSession = Depends(get_db),
) -> list[SamplingProfileSummary]:
    return await sampling_profiles_controller.list_sampling_profiles(db)


@router.post("/reload", response_model=list[SamplingProfileSummary])
async def reload_sampling_profiles(
    db: AsyncSession = Depends(get_db),
) -> list[SamplingProfileSummary]:
    """Re-scan `catalog/sampling-profiles/` and load anything new. Safe
    to call any time: unchanged files re-find their existing hash and
    do nothing.
    """
    return await sampling_profiles_controller.reload_sampling_profiles(db)


@router.get("/catalog-status", response_model=CatalogStatus)
async def get_sampling_profiles_catalog_status(
    db: AsyncSession = Depends(get_db),
) -> CatalogStatus:
    """What a `POST /reload` would do to every file, plus every row a
    reload would leave untouched -- a dry run, so it's a `GET` (S-D16).
    """
    return await sampling_profiles_controller.get_catalog_status(db)
