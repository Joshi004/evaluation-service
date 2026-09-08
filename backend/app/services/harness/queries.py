"""The DB writes for a parsed harness result -- split out of parser.py
so that module stays pure (files in, dataclasses out, no session). Per
.cursor/rules/backend-layering.mdc, this is the only DB access for the
harness package.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EvalRun, Metric
from app.services.harness.parser import ParsedMetric


async def insert_metrics(db: AsyncSession, eval_run_id: int, metrics: list[ParsedMetric]) -> None:
    """One `metric` row per parsed metric. A plain insert, not an
    upsert: today, a given eval_run_id is only ever parsed once. A
    future re-parse script would need to clear the old rows for this
    eval_run_id first, or it will hit Metric's own
    UniqueConstraint(eval_run_id, name).
    """
    rows = [
        Metric(
            eval_run_id=eval_run_id,
            name=metric.name,
            value=metric.value,
            n_samples=metric.n_samples,
            is_primary=metric.is_primary,
        )
        for metric in metrics
    ]
    db.add_all(rows)
    await db.commit()


async def record_harness_result(
    db: AsyncSession,
    eval_run_id: int,
    output_dir: str,
    results_json: dict[str, Any],
    truncation_rate: float | None,
) -> EvalRun | None:
    """Writes exactly the four columns the harness produces. Never
    touches `status` / `started_at` / `finished_at` -- those belong to
    the run's own lifecycle state machine, which is Phase 5's job, not
    this package's.
    """
    eval_run = await db.get(EvalRun, eval_run_id)
    if eval_run is None:
        return None
    eval_run.output_dir = output_dir
    eval_run.results_json = results_json
    eval_run.truncation_rate = truncation_rate
    await db.commit()
    return eval_run
