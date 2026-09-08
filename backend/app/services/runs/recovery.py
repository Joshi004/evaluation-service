"""Startup recovery (docs/IMPLEMENTATION_PHASES.md Phase 5, item 3): the
one line that makes "no reconciler" an honest, safe design rather than a
silent gap. Without it, a run that was `queued` or `running` when the
service last stopped would sit in that status forever -- v1 has no
worker that survives a process restart to finish it, and nothing else
ever re-reads that row.

This is the whole cost of the no-reconciler decision: a backend restart
fails every in-flight run, and resubmitting is the recovery procedure.
The mitigation that makes it acceptable is a separate rule enforced
elsewhere -- every serve job carries an explicit `--time`, so anything
abandoned on the cluster dies on its own regardless of what this backend
does.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EvalRun

logger = logging.getLogger(__name__)

_INTERRUPTED_STATUSES = ("queued", "running")


async def fail_interrupted_runs(db: AsyncSession) -> int:
    """Marks every run left `queued` or `running` by an unclean stop as
    `failed`, with a real, honest reason in `error` rather than a status
    that would otherwise look like it's still in progress forever.
    Returns the number of rows touched, for the lifespan log line.
    """
    result = await db.execute(
        update(EvalRun)
        .where(EvalRun.status.in_(_INTERRUPTED_STATUSES))
        .values(status="failed", error="service restarted", finished_at=datetime.now(UTC))
    )
    await db.commit()
    return result.rowcount
