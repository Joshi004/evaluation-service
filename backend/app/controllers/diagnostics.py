"""Diagnostics controller -- validates the run's status and shapes the
response; no direct DB queries or file I/O here, both stay in
app/services/diagnostics/ (.cursor/rules/backend-layering.mdc).
"""

import asyncio
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.diagnostics import (
    DiagnosticsSampleDetail,
    RunComparison,
    RunDiagnostics,
    SampleFilters,
    SamplePage,
)
from app.services.diagnostics import compare, sample_detail, sample_query, store
from app.services.diagnostics import queries as diagnostics_queries
from app.services.harness import runner as harness_runner


class RunNotFinishedError(Exception):
    """The run exists but hasn't reached `done` -- the router maps this
    to 409. A queued or running run has no samples yet, which is a
    different situation from a finished run with zero failures, and
    must never be silently served as an empty summary
    (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 3).
    """


async def _load_payload(
    db: AsyncSession, eval_run_id: int, *, force_rebuild: bool = False
) -> dict[str, Any] | None:
    """The shared front door for every endpoint below: resolves the run
    and the facts its diagnostics file needs, refuses a run that isn't
    `done`, then loads or (forcibly) rebuilds the file.

    Offloaded to a thread -- a cold rebuild parses tens of megabytes of
    JSONL (run-13's reviews and predictions files alone total to
    ~20MB), which would otherwise stall every other request on this
    process for the duration.
    """
    context = await diagnostics_queries.load_diagnostics_run_context(db, eval_run_id)
    if context is None:
        return None
    if context.status != "done":
        raise RunNotFinishedError(f"run {eval_run_id} is {context.status}, not done")

    # force_rebuild also forces a fresh recheck container (Phase 5) --
    # otherwise POST /diagnostics/rebuild could silently just replay a
    # cached recheck artifact, which defeats the one thing "force"
    # promises the caller.
    if force_rebuild:
        return await asyncio.to_thread(
            store.build_and_write, context.build_spec, force_recheck=True
        )
    return await asyncio.to_thread(store.load_or_build, context.build_spec)


async def get_diagnostics(
    db: AsyncSession, eval_run_id: int, *, force_rebuild: bool = False
) -> RunDiagnostics | None:
    """Summary and buckets, never the samples array (Section 3.5) --
    `RunDiagnostics` simply has no `samples` field, so Pydantic's
    default `extra="ignore"` drops it on `model_validate` with no
    manual key-stripping.
    """
    payload = await _load_payload(db, eval_run_id, force_rebuild=force_rebuild)
    if payload is None:
        return None
    return RunDiagnostics.model_validate(payload)


async def get_samples(
    db: AsyncSession, eval_run_id: int, filters: SampleFilters
) -> SamplePage | None:
    payload = await _load_payload(db, eval_run_id)
    if payload is None:
        return None
    return sample_query.filter_samples(payload, filters)


async def get_sample(
    db: AsyncSession, eval_run_id: int, sample_key: str
) -> DiagnosticsSampleDetail | None:
    """`None` covers both an unknown run and an unknown sample_key
    inside a known run -- the router maps either to the same 404.

    Offloaded to a thread alongside the payload load itself: Phase 7's
    `sample_detail.find_sample_detail` reads a second file -- the
    run's reviews file, by index, which can be tens of megabytes for
    MMLU-Pro -- so this request does two blocking reads, not one.
    """
    payload = await _load_payload(db, eval_run_id)
    if payload is None:
        return None
    run_dir = harness_runner.run_directory(eval_run_id)
    return await asyncio.to_thread(sample_detail.find_sample_detail, payload, run_dir, sample_key)


async def compare_runs(
    db: AsyncSession, eval_run_id: int, other_run_id: int
) -> RunComparison | None:
    """Loads both sides through the same `_load_payload` front door as
    every other endpoint above -- an unknown or not-`done` run on
    either side surfaces as the same 404/409 this module already
    raises elsewhere, with no special-casing for which side it was.

    Skips loading `other_run_id` when `eval_run_id` itself doesn't
    exist: there is no comparison to build either way, and this keeps
    a 404 on the first (more likely to be a typo'd) id from paying for
    a second file read.
    """
    left = await _load_payload(db, eval_run_id)
    right = await _load_payload(db, other_run_id) if left is not None else None
    if left is None or right is None:
        return None
    return compare.compare_payloads(left, right)
