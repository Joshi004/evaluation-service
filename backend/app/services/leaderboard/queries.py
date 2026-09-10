"""The leaderboard query -- the only DB access for the leaderboard
resource (app.api.v1.leaderboard -> app.controllers.leaderboard -> here),
per .cursor/rules/backend-layering.mdc.

LEADERBOARD_QUERY started as the raw SQL given verbatim in
docs/IMPLEMENTATION_PHASES.md, kept as sa.text() rather than the ORM
since it's meant to be read as SQL, not re-derived; Phase 3
(docs/STANDARDS_AND_PROFILES_PHASES.md) regrouped it onto
`comparison_hash`. There is no publish gate and no
standard-versus-exploratory filter: every finished result is visible,
and the UI colours by comparison hash so it's obvious at a glance which
cells were produced the same way -- same standard AND same resolved
sampling profile, not just the same standard.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.leaderboard import LeaderboardRow

LEADERBOARD_QUERY = text("""
    SELECT DISTINCT ON (r.checkpoint_id, r.comparison_hash)
           r.checkpoint_id, r.standard_id, s.benchmark, s.hash AS standard_hash, s.label,
           r.comparison_hash, sp.label AS sampling_profile_label,
           m.name, m.value, m.n_samples, r.truncation_rate, r.finished_at
    FROM   eval_run         r
    JOIN   standard         s  ON s.id = r.standard_id
    JOIN   sampling_profile sp ON sp.id = r.sampling_profile_id
    JOIN   metric           m  ON m.eval_run_id = r.id AND m.is_primary
    WHERE  r.status = 'done'
    ORDER  BY r.checkpoint_id, r.comparison_hash, r.finished_at DESC
""")


async def get_leaderboard_rows(db: AsyncSession) -> list[LeaderboardRow]:
    """One row per (checkpoint, comparison_hash) pair, each carrying its
    most recent primary metric. Empty until a later phase produces
    finished eval_run rows -- pivoting into a checkpoints-by-benchmarks
    grid is a frontend concern (LeaderboardPage.helper.ts), not this
    query's job.
    """
    rows = (await db.execute(LEADERBOARD_QUERY)).all()
    return [
        LeaderboardRow(
            checkpoint_id=row.checkpoint_id,
            standard_id=row.standard_id,
            benchmark=row.benchmark,
            standard_hash=row.standard_hash,
            label=row.label,
            comparison_hash=row.comparison_hash,
            sampling_profile_label=row.sampling_profile_label,
            metric_name=row.name,
            metric_value=row.value,
            n_samples=row.n_samples,
            truncation_rate=row.truncation_rate,
            finished_at=row.finished_at,
        )
        for row in rows
    ]
