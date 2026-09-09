"""Checkpoint queries -- the only DB access for the checkpoints resource
(app.api.v1.checkpoints -> app.controllers.checkpoints -> here), per
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint, EvalRun, ServingProfile
from app.schemas.checkpoints import (
    CheckpointDetail,
    CheckpointInferredMetadata,
    CheckpointListItem,
    CheckpointRunSummary,
)


async def list_registered_checkpoint_paths(db: AsyncSession) -> set[str]:
    """Every registered checkpoint's `path`, for the discovery
    controller to mark `already_registered` on each candidate -- one
    query for the whole listing, never one per candidate. Commits
    immediately so this read's transaction isn't left open across the
    SSH call the controller makes right after (see
    .cursor/rules/dev-workflow.mdc and R-T17).
    """
    rows = (await db.execute(select(Checkpoint.path))).all()
    await db.commit()
    return {path for (path,) in rows}


async def list_checkpoints(db: AsyncSession) -> list[CheckpointListItem]:
    """Every registered checkpoint, ordered by family then name so the
    frontend's `GROUP BY family` display (CheckpointDetailPage.tsx) gets
    each family's rows already adjacent.
    """
    stmt = (
        select(Checkpoint, ServingProfile.label, ServingProfile.hash)
        .join(ServingProfile, Checkpoint.default_serving_profile_id == ServingProfile.id)
        .order_by(Checkpoint.family, Checkpoint.name)
    )
    rows = (await db.execute(stmt)).all()
    return [
        CheckpointListItem(
            id=checkpoint.id,
            name=checkpoint.name,
            family=checkpoint.family,
            path=checkpoint.path,
            parent_checkpoint_id=checkpoint.parent_checkpoint_id,
            serving_profile_label=serving_profile_label,
            serving_profile_hash=serving_profile_hash,
            created_at=checkpoint.created_at,
            availability_status=checkpoint.availability_status,
            availability_checked_at=checkpoint.availability_checked_at,
        )
        for checkpoint, serving_profile_label, serving_profile_hash in rows
    ]


async def get_checkpoint_with_runs(db: AsyncSession, checkpoint_id: int) -> CheckpointDetail | None:
    """One checkpoint plus its eval runs. The run list is empty this
    phase -- no eval_run rows exist until Phase 3 submits real jobs.
    """
    stmt = (
        select(Checkpoint, ServingProfile.label, ServingProfile.hash)
        .join(ServingProfile, Checkpoint.default_serving_profile_id == ServingProfile.id)
        .where(Checkpoint.id == checkpoint_id)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return None
    checkpoint, serving_profile_label, serving_profile_hash = row

    runs_stmt = (
        select(EvalRun)
        .where(EvalRun.checkpoint_id == checkpoint_id)
        .order_by(EvalRun.created_at.desc())
    )
    runs = (await db.execute(runs_stmt)).scalars().all()

    return CheckpointDetail(
        id=checkpoint.id,
        name=checkpoint.name,
        family=checkpoint.family,
        path=checkpoint.path,
        parent_checkpoint_id=checkpoint.parent_checkpoint_id,
        serving_profile_label=serving_profile_label,
        serving_profile_hash=serving_profile_hash,
        created_at=checkpoint.created_at,
        availability_status=checkpoint.availability_status,
        availability_checked_at=checkpoint.availability_checked_at,
        generation_config=checkpoint.generation_config,
        registered_by=checkpoint.registered_by,
        inferred=CheckpointInferredMetadata(
            model_type=checkpoint.model_type,
            architecture=checkpoint.architecture,
            base_model=checkpoint.base_model,
            context_length=checkpoint.context_length,
            torch_dtype=checkpoint.torch_dtype,
            quantization=checkpoint.quantization,
            weight_format=checkpoint.weight_format,
            shard_count=checkpoint.shard_count,
            size_bytes=checkpoint.size_bytes,
            source_config=checkpoint.source_config,
        ),
        availability_detail=checkpoint.availability_detail,
        runs=[
            CheckpointRunSummary(
                id=run.id,
                recipe_id=run.recipe_id,
                status=run.status,
                created_at=run.created_at,
                finished_at=run.finished_at,
            )
            for run in runs
        ],
    )
