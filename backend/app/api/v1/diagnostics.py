"""Diagnostics endpoints: the per-run summary/buckets, the filtered and
paged sample list, one sample by key, and a forced rebuild
(docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Section 3.5, Phase 3).

Mounted under the existing `/runs` prefix (app/api/router.py) -- these
are sub-resources of a run, not a resource of their own.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import diagnostics as diagnostics_controller
from app.controllers.diagnostics import RunNotFinishedError
from app.db import get_db
from app.schemas.diagnostics import (
    DiagnosticsSampleDetail,
    RunComparison,
    RunDiagnostics,
    SampleFilters,
    SamplePage,
)

router = APIRouter()


@router.get("/{run_id}/diagnostics", response_model=RunDiagnostics)
async def get_diagnostics(run_id: int, db: AsyncSession = Depends(get_db)) -> RunDiagnostics:
    try:
        diagnostics = await diagnostics_controller.get_diagnostics(db, run_id)
    except RunNotFinishedError as exc:
        # 409: a queued or running run has no samples, which is a
        # different thing from a finished run with zero failures.
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if diagnostics is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return diagnostics


@router.post("/{run_id}/diagnostics/rebuild", response_model=RunDiagnostics)
async def rebuild_diagnostics(run_id: int, db: AsyncSession = Depends(get_db)) -> RunDiagnostics:
    """Forces a rebuild regardless of the file's own schema_version --
    the controller calls `store.build_and_write` unconditionally here,
    never `load_or_build`.
    """
    try:
        diagnostics = await diagnostics_controller.get_diagnostics(db, run_id, force_rebuild=True)
    except RunNotFinishedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if diagnostics is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return diagnostics


@router.get("/{run_id}/samples", response_model=SamplePage)
async def list_samples(
    run_id: int,
    passed: bool | None = None,
    subset: str | None = None,
    # A sample *carries* this rule id (Section 3.5) -- Phase 5 onward,
    # once a sample's benchmark_details can actually hold one.
    rule: str | None = None,
    # A sample *carries* this tag (Section 3.5) -- Phase 8 onward, once
    # a sample's own `tags` list can be non-empty.
    tag: str | None = None,
    q: str | None = None,
    # Capped at 200 and validated here, at the schema boundary, so a
    # caller can never request all 12,000+ samples a full MMLU-Pro run
    # can carry (Section 3.5).
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    db: AsyncSession = Depends(get_db),
) -> SamplePage:
    filters = SampleFilters(
        passed=passed, subset=subset, rule=rule, tag=tag, q=q, limit=limit, offset=offset
    )
    try:
        page = await diagnostics_controller.get_samples(db, run_id, filters)
    except RunNotFinishedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if page is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return page


@router.get("/{run_id}/samples/{sample_key}", response_model=DiagnosticsSampleDetail)
async def get_sample(
    run_id: int, sample_key: str, db: AsyncSession = Depends(get_db)
) -> DiagnosticsSampleDetail:
    try:
        sample = await diagnostics_controller.get_sample(db, run_id, sample_key)
    except RunNotFinishedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if sample is None:
        # Covers both an unknown run_id and an unknown sample_key
        # inside a known run (app/controllers/diagnostics.py) -- both
        # are the same 404 to a caller.
        raise HTTPException(status_code=404, detail="Run or sample not found")
    return sample


@router.get("/{run_id}/compare/{other_run_id}", response_model=RunComparison)
async def compare_runs(
    run_id: int, other_run_id: int, db: AsyncSession = Depends(get_db)
) -> RunComparison:
    """Section 3.5, Phase 9. Self-compare (`run_id == other_run_id`) is
    allowed deliberately -- zero flips and a zero delta is a required
    behaviour (Phase 9's "done when"), not an edge case to reject.
    """
    try:
        comparison = await diagnostics_controller.compare_runs(db, run_id, other_run_id)
    except RunNotFinishedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if comparison is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return comparison
