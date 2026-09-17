"""The one DB query Phase 3's lazy-rebuild path needs
(docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 3): a run's status,
plus everything `store.load_or_build`/`build_and_write` require to
build its diagnostics file, joined in one round trip.

Deliberately not `runs.queries.load_run_context` -- that query also
joins `Endpoint` and `ServingProfile` (which this path never needs) and
commits to close the worker's own read transaction before a slow
harness run follows in the same request. Neither belongs to a request
handler serving a GET.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint, EvalRun, SamplingProfile, Standard
from app.services.diagnostics.store import DiagnosticsBuildSpec


@dataclass
class DiagnosticsRunContext:
    """`status` decides 404 vs 409 vs "go ahead and load or build"
    (app/controllers/diagnostics.py); `build_spec` is handed straight
    to `store.load_or_build` or `store.build_and_write`, the same
    dataclass `worker.py` already builds from its own `RunContext`
    once a run finishes.
    """

    status: str
    build_spec: DiagnosticsBuildSpec


async def load_diagnostics_run_context(
    db: AsyncSession, eval_run_id: int
) -> DiagnosticsRunContext | None:
    """`None` means the router 404s. Joins `Standard` for `benchmark`,
    `task_name`, `metrics` and `framework_image`, `Checkpoint` for
    `served_model_name` (`checkpoint.name` -- never a path
    reconstruction, Section 8's first trap), and `SamplingProfile` for
    `max_tokens`, which `evalscope_reviews._build_health` needs for the
    truncation count.
    """
    stmt = (
        select(EvalRun, Standard, Checkpoint, SamplingProfile)
        .join(Standard, EvalRun.standard_id == Standard.id)
        .join(Checkpoint, EvalRun.checkpoint_id == Checkpoint.id)
        .join(SamplingProfile, EvalRun.sampling_profile_id == SamplingProfile.id)
        .where(EvalRun.id == eval_run_id)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return None
    eval_run, standard, checkpoint, sampling_profile = row

    return DiagnosticsRunContext(
        status=eval_run.status,
        build_spec=DiagnosticsBuildSpec(
            eval_run_id=eval_run_id,
            benchmark=standard.benchmark,
            task_name=standard.task_name,
            served_model_name=checkpoint.name,
            metric_specs=standard.metrics,
            harness_image=standard.framework_image,
            max_tokens=sampling_profile.max_tokens,
        ),
    )
