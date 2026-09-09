"""Checkpoint queries -- the only DB access for the checkpoints resource
(app.api.v1.checkpoints -> app.controllers.checkpoints -> here), per
.cursor/rules/backend-layering.mdc.
"""

from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint, EvalRun, ServingProfile
from app.schemas.checkpoints import (
    CheckpointDetail,
    CheckpointInferredMetadata,
    CheckpointListItem,
    CheckpointRunSummary,
)
from app.schemas.discovery import CheckpointInspection


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


async def get_checkpoint(db: AsyncSession, checkpoint_id: int) -> Checkpoint | None:
    """The ORM row itself, for a caller that needs to act on it --
    registration's lineage walk and availability's re-check -- as
    opposed to `get_checkpoint_with_runs`'s already-shaped response DTO.
    """
    return await db.get(Checkpoint, checkpoint_id)


async def get_checkpoint_by_name(db: AsyncSession, name: str) -> Checkpoint | None:
    """Registration's duplicate-name pre-check (R-T19) -- a pre-check
    alone still races, so `registration.py` also catches the database's
    own UNIQUE constraint violation.
    """
    stmt = select(Checkpoint).where(Checkpoint.name == name)
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_checkpoint_by_path(db: AsyncSession, path: str) -> Checkpoint | None:
    """Registration's duplicate-path pre-check (R-D23): two names for
    one directory would produce two leaderboard entries for one model.
    """
    stmt = select(Checkpoint).where(Checkpoint.path == path)
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_default_profile_ids_for_model_type(db: AsyncSession, model_type: str) -> list[int]:
    """Every `default_serving_profile_id` used by an already-registered
    checkpoint of this `model_type`, most recently registered first --
    feeds `recommend_serving_profile`'s "a derived checkpoint reuses its
    base's profile" rule. Deduplicated in Python, preserving that
    recency order, rather than with `SELECT DISTINCT`, which would not
    let us keep it.
    """
    stmt = (
        select(Checkpoint.default_serving_profile_id)
        .where(Checkpoint.model_type == model_type)
        .order_by(Checkpoint.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    deduplicated_ids: dict[int, None] = {}
    for (profile_id,) in rows:
        deduplicated_ids[profile_id] = None
    return list(deduplicated_ids)


async def insert_checkpoint(
    db: AsyncSession,
    name: str,
    path: str,
    family: str | None,
    parent_checkpoint_id: int | None,
    default_serving_profile_id: int,
    registered_by: str | None,
    inspection: CheckpointInspection,
) -> Checkpoint:
    """Write a new checkpoint row. Only called once registration has
    already passed every 404/409 check (R-T18) -- nothing here can fail
    for a reason the caller hasn't already ruled out, except the
    UNIQUE constraint race `registration.py` catches around this call.

    Takes the whole `CheckpointInspection` rather than ten separate
    scalars so a field added to the DTO later can't be forgotten here.
    Always writes `availability_status='available'`: the inspection
    just proved the weights are readable, so recording anything less
    would misrepresent what was just read (R-D24).
    """
    checkpoint = Checkpoint(
        name=name,
        path=path,
        family=family,
        parent_checkpoint_id=parent_checkpoint_id,
        default_serving_profile_id=default_serving_profile_id,
        generation_config=inspection.generation_config,
        registered_by=registered_by,
        model_type=inspection.model_type,
        architecture=inspection.architecture,
        base_model=inspection.base_model,
        context_length=inspection.context_length,
        torch_dtype=inspection.torch_dtype,
        quantization=inspection.quantization,
        weight_format=inspection.weight_format,
        shard_count=inspection.shard_count,
        size_bytes=inspection.size_bytes,
        source_config=inspection.source_config,
        availability_status="available",
        availability_checked_at=datetime.now(UTC),
    )
    db.add(checkpoint)
    await db.flush()  # populates checkpoint.id via Postgres RETURNING
    await db.commit()
    return checkpoint


async def update_checkpoint_availability(
    db: AsyncSession,
    checkpoint_id: int,
    status: Literal["unknown", "available", "unavailable", "incomplete"],
    detail: str | None,
    checked_at: datetime,
) -> None:
    """Writes exactly the three availability columns and nothing else
    (R-D1) -- a validate-only check never touches a row's registration
    data, and never deletes the row regardless of the result.
    """
    checkpoint = await db.get(Checkpoint, checkpoint_id)
    if checkpoint is None:
        return
    checkpoint.availability_status = status
    checkpoint.availability_detail = detail
    checkpoint.availability_checked_at = checked_at
    await db.commit()
