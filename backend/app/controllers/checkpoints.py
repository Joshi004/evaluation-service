"""Checkpoint controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.checkpoints import CheckpointDetail, CheckpointListItem, RegisterCheckpointRequest
from app.schemas.discovery import CheckpointCandidate, CheckpointInspection
from app.services.checkpoints import availability as availability_service
from app.services.checkpoints import queries as checkpoints_service
from app.services.checkpoints import registration as registration_service
from app.services.checkpoints.recommendation import (
    recommend_sampling_profile,
    recommend_serving_profile,
)
from app.services.cluster import get_model_discovery
from app.services.sampling_profiles import queries as sampling_profiles_service
from app.services.serving_profiles import queries as serving_profiles_service


async def list_checkpoints(db: AsyncSession) -> list[CheckpointListItem]:
    return await checkpoints_service.list_checkpoints(db)


async def get_checkpoint(db: AsyncSession, checkpoint_id: int) -> CheckpointDetail | None:
    return await checkpoints_service.get_checkpoint_with_runs(db, checkpoint_id)


async def list_checkpoint_candidates(db: AsyncSession) -> list[CheckpointCandidate]:
    """Registered paths first, then the (slow) SSH listing, so the read's
    transaction is already closed before the cluster call starts
    (R-T17). `already_registered` is joined in here, not in the port
    (R-D14) -- `SshModelDiscovery` has no idea the database exists.
    """
    registered_paths = await checkpoints_service.list_registered_checkpoint_paths(db)
    discovery = get_model_discovery()
    candidates = await discovery.list_checkpoint_candidates()
    return [
        candidate.model_copy(update={"already_registered": candidate.reference in registered_paths})
        for candidate in candidates
    ]


async def inspect_checkpoint_candidate(db: AsyncSession, reference: str) -> CheckpointInspection:
    """Inspects over SSH first, then attaches a serving-profile and a
    sampling-profile recommendation, each built from already-registered
    rows -- mirrors how `list_checkpoint_candidates` above sets
    `already_registered` (R-D14: `SshModelDiscovery` itself never
    touches the database, so the controller is where the two are
    joined).
    """
    discovery = get_model_discovery()
    inspection = await discovery.inspect_checkpoint(reference)

    profiles = await serving_profiles_service.list_serving_profiles(db)
    profile_ids_for_same_model_type: list[int] = []
    if inspection.model_type is not None:
        profile_ids_for_same_model_type = (
            await checkpoints_service.list_default_profile_ids_for_model_type(
                db, inspection.model_type
            )
        )
    recommendation = recommend_serving_profile(
        inspection, profiles, profile_ids_for_same_model_type
    )

    sampling_profiles = await sampling_profiles_service.list_sampling_profiles(db)
    sampling_profile_ids_for_same_model_type: list[int] = []
    if inspection.model_type is not None:
        sampling_profile_ids_for_same_model_type = (
            await checkpoints_service.list_default_sampling_profile_ids_for_model_type(
                db, inspection.model_type
            )
        )
    sampling_recommendation = recommend_sampling_profile(
        inspection, sampling_profiles, sampling_profile_ids_for_same_model_type
    )

    return inspection.model_copy(
        update={
            "recommendation": recommendation,
            "sampling_recommendation": sampling_recommendation,
        }
    )


async def register_checkpoint(
    db: AsyncSession, request: RegisterCheckpointRequest
) -> CheckpointDetail:
    return await registration_service.register_checkpoint(db, request)


async def check_checkpoint_availability(
    db: AsyncSession, checkpoint_id: int
) -> CheckpointDetail | None:
    return await availability_service.check_availability(db, checkpoint_id)
