"""The leaderboard query -- the only DB access for the leaderboard
resource (app.api.v1.leaderboard -> app.controllers.leaderboard -> here),
per .cursor/rules/backend-layering.mdc.

LEADERBOARD_QUERY started as the raw SQL given verbatim in
docs/IMPLEMENTATION_PHASES.md, kept as sa.text() rather than the ORM
since it's meant to be read as SQL, not re-derived; Phase 3
(docs/STANDARDS_AND_PROFILES_PHASES.md) regrouped it onto
`comparison_hash`. There is no publish gate and no
standard-versus-exploratory filter: every finished result on the full
benchmark is visible, and the UI keeps track of which cells were
produced the same way -- same standard AND same resolved sampling
profile, not just the same standard.

The one exclusion is a capped run (`standard.sample_limit` set): it
scores only part of the benchmark, so it is a smoke test, not the
benchmark's score, and a lucky small sample could otherwise take a
model's headline number. Capped runs stay visible on the Runs page and
on their own run pages.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.leaderboard import LeaderboardRow
from app.services.diagnostics.report_summary import wilson_interval

LEADERBOARD_QUERY = text("""
    SELECT DISTINCT ON (r.checkpoint_id, r.comparison_hash)
           r.id AS eval_run_id,
           r.checkpoint_id, r.standard_id, s.benchmark, s.hash AS standard_hash, s.label,
           r.comparison_hash, sp.label AS sampling_profile_label, sp.hash AS sampling_profile_hash,
           sv.label AS serving_profile_label, sv.hash AS serving_profile_hash,
           m.name, m.value, m.n_samples, r.truncation_rate, r.finished_at
    FROM   eval_run         r
    JOIN   standard         s  ON s.id = r.standard_id
    JOIN   sampling_profile sp ON sp.id = r.sampling_profile_id
    JOIN   serving_profile  sv ON sv.id = r.serving_profile_id
    JOIN   metric           m  ON m.eval_run_id = r.id AND m.is_primary
    WHERE  r.status = 'done'
      AND  s.sample_limit IS NULL
    ORDER  BY r.checkpoint_id, r.comparison_hash, r.finished_at DESC
""")


async def get_leaderboard_rows(db: AsyncSession) -> list[LeaderboardRow]:
    """One row per (checkpoint, comparison_hash) pair, each carrying its
    most recent primary metric. Empty until a later phase produces
    finished eval_run rows -- pivoting into a checkpoints-by-benchmarks
    grid is a frontend concern (LeaderboardPage.helper.ts), not this
    query's job.

    `confidence_interval` is `None` only when `n_samples` is missing --
    the same guard `report_summary._to_metric_performance` uses, since
    Wilson's interval needs a sample count to be defined at all. Every
    row here already carries a genuine per-sample pass-rate primary
    metric (the join above only ever selects `m.is_primary`), so no
    further guard on which metric this is is needed, unlike that
    function's own `metric_row.is_primary` check.
    """
    rows = (await db.execute(LEADERBOARD_QUERY)).all()
    return [
        LeaderboardRow(
            checkpoint_id=row.checkpoint_id,
            eval_run_id=row.eval_run_id,
            standard_id=row.standard_id,
            benchmark=row.benchmark,
            standard_hash=row.standard_hash,
            label=row.label,
            comparison_hash=row.comparison_hash,
            sampling_profile_label=row.sampling_profile_label,
            sampling_profile_hash=row.sampling_profile_hash,
            serving_profile_label=row.serving_profile_label,
            serving_profile_hash=row.serving_profile_hash,
            metric_name=row.name,
            metric_value=row.value,
            n_samples=row.n_samples,
            confidence_interval=wilson_interval(row.value, row.n_samples)
            if row.n_samples
            else None,
            truncation_rate=row.truncation_rate,
            finished_at=row.finished_at,
        )
        for row in rows
    ]
