"""The leaderboard query -- the only DB access for the leaderboard
resource (app.api.v1.leaderboard -> app.controllers.leaderboard -> here),
per .cursor/rules/backend-layering.mdc.

LEADERBOARD_QUERY is used verbatim from docs/IMPLEMENTATION_PHASES.md
via sa.text() rather than the ORM, since it's given there as raw SQL not
to be re-derived. There is no publish gate and no
standard-versus-exploratory filter: every finished result is visible,
and the UI colours by recipe hash so it's obvious at a glance which
cells were produced the same way.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.leaderboard import LeaderboardRow

LEADERBOARD_QUERY = text("""
    SELECT DISTINCT ON (r.checkpoint_id, r.recipe_id)
           r.checkpoint_id, r.recipe_id, rc.benchmark, rc.hash AS recipe_hash, rc.label,
           m.name, m.value, m.n_samples, r.truncation_rate, r.finished_at
    FROM   eval_run r
    JOIN   recipe   rc ON rc.id = r.recipe_id
    JOIN   metric   m  ON m.eval_run_id = r.id AND m.is_primary
    WHERE  r.status = 'done'
    ORDER  BY r.checkpoint_id, r.recipe_id, r.finished_at DESC
""")


async def get_leaderboard_rows(db: AsyncSession) -> list[LeaderboardRow]:
    """One row per (checkpoint, recipe) pair, each carrying its most
    recent primary metric. Empty until a later phase produces finished
    eval_run rows -- pivoting into a checkpoints-by-benchmarks grid is a
    frontend concern (LeaderboardPage.helper.ts), not this query's job.
    """
    rows = (await db.execute(LEADERBOARD_QUERY)).all()
    return [
        LeaderboardRow(
            checkpoint_id=row.checkpoint_id,
            recipe_id=row.recipe_id,
            benchmark=row.benchmark,
            recipe_hash=row.recipe_hash,
            label=row.label,
            metric_name=row.name,
            metric_value=row.value,
            n_samples=row.n_samples,
            truncation_rate=row.truncation_rate,
            finished_at=row.finished_at,
        )
        for row in rows
    ]
