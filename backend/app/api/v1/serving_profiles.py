"""Serving-profile endpoints: list every profile, labelled standards and
ad-hoc customisations alike, for the registration wizard's profile
picker (Phase 5, item 5); rescan `catalog/serving-profiles/` and preview
what a reload would do (Phase 1). No other write route here -- a profile
is otherwise created only as a side effect of registration resolving a
customisation.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import serving_profiles as serving_profiles_controller
from app.db import get_db
from app.schemas.catalog import CatalogPruneResult, CatalogStatus
from app.schemas.serving_profiles import ServingProfileSummary
from app.services.catalog.deletion import DeletionBlockedError

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


@router.post("/prune", response_model=CatalogPruneResult)
async def prune_serving_profiles(db: AsyncSession = Depends(get_db)) -> CatalogPruneResult:
    """Delete every unreferenced ad-hoc serving profile (S-D31): safe
    by construction -- unlabelled means no file made it, and zero
    references means nothing can be looking at it -- so this is
    routine cleanup, not a dangerous operation.
    """
    return await serving_profiles_controller.prune_serving_profiles(db)


@router.delete("/{serving_profile_id}", status_code=204)
async def delete_serving_profile(
    serving_profile_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Declared last (Phase 6, Build item 4): `/catalog-status` and
    `/prune` above must both be matched before FastAPI tries this
    route's `int` path converter, or a request to either would 422
    here instead of reaching its own handler -- R-T5's route-ordering
    trap all over again.
    """
    try:
        deleted = await serving_profiles_controller.delete_serving_profile(db, serving_profile_id)
    except DeletionBlockedError as exc:
        # 409: the row exists but S-D10's guards refuse it, every
        # blocker named at once (S-T26) -- the same style
        # SubmitValidationError -> 400 already uses in runs.py.
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Serving profile not found")
