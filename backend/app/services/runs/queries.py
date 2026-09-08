"""Eval run queries -- the only DB access for the runs resource
(app.api.v1.runs -> app.controllers.runs -> here), per
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EvalRun
from app.schemas.runs import RunListItem


async def list_runs(
    db: AsyncSession, status: str | None, run_group_id: int | None
) -> list[RunListItem]:
    """Eval runs, most recent first, optionally filtered by status
    and/or run group. Empty this phase -- no eval_run rows are written
    until Phase 3 submits real jobs to the cluster.
    """
    stmt = select(EvalRun).order_by(EvalRun.created_at.desc())
    if status is not None:
        stmt = stmt.where(EvalRun.status == status)
    if run_group_id is not None:
        stmt = stmt.where(EvalRun.run_group_id == run_group_id)

    runs = (await db.execute(stmt)).scalars().all()
    return [
        RunListItem(
            id=run.id,
            run_group_id=run.run_group_id,
            checkpoint_id=run.checkpoint_id,
            recipe_id=run.recipe_id,
            endpoint_id=run.endpoint_id,
            status=run.status,
            truncation_rate=run.truncation_rate,
            error=run.error,
            submitted_by=run.submitted_by,
            created_at=run.created_at,
            started_at=run.started_at,
            finished_at=run.finished_at,
        )
        for run in runs
    ]
