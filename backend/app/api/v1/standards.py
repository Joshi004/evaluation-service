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

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import standards as standards_controller
from app.db import get_db
from app.schemas.catalog import CatalogPruneResult, CatalogStatus
from app.schemas.standards import StandardSummary
from app.services.catalog.deletion import DeletionBlockedError

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


@router.post("/prune", response_model=CatalogPruneResult)
async def prune_standards(db: AsyncSession = Depends(get_db)) -> CatalogPruneResult:
    """Delete every unreferenced ad-hoc standard (S-D31): safe by
    construction -- unlabelled means no file made it, and zero
    references means nothing can be looking at it -- so this is
    routine cleanup, not a dangerous operation.
    """
    return await standards_controller.prune_standards(db)


@router.delete("/{standard_id}", status_code=204)
async def delete_standard(standard_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Declared last (Phase 6, Build item 4): `/catalog-status` and
    `/prune` above must both be matched before FastAPI tries this
    route's `int` path converter, or a request to either would 422
    here instead of reaching its own handler -- R-T5's route-ordering
    trap all over again.
    """
    try:
        deleted = await standards_controller.delete_standard(db, standard_id)
    except DeletionBlockedError as exc:
        # 409: the row exists but S-D10's guards refuse it, every
        # blocker named at once (S-T26) -- the same style
        # SubmitValidationError -> 400 already uses in runs.py.
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Standard not found")
