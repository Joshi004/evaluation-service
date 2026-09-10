"""Serving-profile endpoints: list every profile, labelled standards and
ad-hoc customisations alike, for the registration wizard's profile
picker (Phase 5, item 5); rescan `catalog/serving-profiles/` and preview
what a reload would do (Phase 1). No other write route here -- a profile
is otherwise created only as a side effect of registration resolving a
customisation.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import serving_profiles as serving_profiles_controller
from app.db import get_db
from app.schemas.catalog import CatalogStatus
from app.schemas.serving_profiles import ServingProfileSummary

router = APIRouter()


@router.get("", response_model=list[ServingProfileSummary])
async def list_serving_profiles(
    db: AsyncSession = Depends(get_db),
) -> list[ServingProfileSummary]:
    return await serving_profiles_controller.list_serving_profiles(db)


@router.post("/reload", response_model=list[ServingProfileSummary])
async def reload_serving_profiles(
    db: AsyncSession = Depends(get_db),
) -> list[ServingProfileSummary]:
    """Re-scan `catalog/serving-profiles/` and load anything new. Safe
    to call any time: unchanged files re-find their existing hash and
    do nothing.
    """
    return await serving_profiles_controller.reload_serving_profiles(db)


@router.get("/catalog-status", response_model=CatalogStatus)
async def get_serving_profiles_catalog_status(
    db: AsyncSession = Depends(get_db),
) -> CatalogStatus:
    """What a `POST /reload` would do to every file, plus every row a
    reload would leave untouched -- a dry run, so it's a `GET` (S-D16).
    """
    return await serving_profiles_controller.get_catalog_status(db)
