"""Checkpoint controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.checkpoints import CheckpointDetail, CheckpointListItem
from app.schemas.discovery import CheckpointCandidate, CheckpointInspection
from app.services.checkpoints import queries as checkpoints_service
from app.services.cluster import get_model_discovery


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


async def inspect_checkpoint_candidate(reference: str) -> CheckpointInspection:
    """A pure pass-through to the port -- no session parameter at all,
    unlike every other function in this module, because discovery never
    touches the database (R-D14).
    """
    discovery = get_model_discovery()
    return await discovery.inspect_checkpoint(reference)
