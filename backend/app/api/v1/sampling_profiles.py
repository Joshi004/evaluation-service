"""Sampling-profile endpoints: list every profile, labelled catalog
entries and ad-hoc customisations alike (Phase 3+ mints the latter);
rescan `catalog/sampling-profiles/` and preview what a reload would do.
See docs/STANDARDS_AND_PROFILES_PHASES.md Phase 2, item 9 -- a direct
mirror of app/api/v1/serving_profiles.py, one catalog over.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import sampling_profiles as sampling_profiles_controller
from app.db import get_db
from app.schemas.catalog import CatalogPruneResult, CatalogStatus
from app.schemas.sampling_profiles import SamplingProfileSummary
from app.services.catalog.deletion import DeletionBlockedError

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


@router.post("/prune", response_model=CatalogPruneResult)
async def prune_sampling_profiles(db: AsyncSession = Depends(get_db)) -> CatalogPruneResult:
    """Delete every unreferenced ad-hoc sampling profile (S-D31): safe
    by construction -- unlabelled means no file made it, and zero
    references means nothing can be looking at it -- so this is
    routine cleanup, not a dangerous operation.
    """
    return await sampling_profiles_controller.prune_sampling_profiles(db)


@router.delete("/{sampling_profile_id}", status_code=204)
async def delete_sampling_profile(
    sampling_profile_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Declared last (Phase 6, Build item 4): `/catalog-status` and
    `/prune` above must both be matched before FastAPI tries this
    route's `int` path converter, or a request to either would 422
    here instead of reaching its own handler -- R-T5's route-ordering
    trap all over again.
    """
    try:
        deleted = await sampling_profiles_controller.delete_sampling_profile(
            db, sampling_profile_id
        )
    except DeletionBlockedError as exc:
        # 409: the row exists but S-D10's guards refuse it, every
        # blocker named at once (S-T26) -- the same style
        # SubmitValidationError -> 400 already uses in runs.py.
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Sampling profile not found")
