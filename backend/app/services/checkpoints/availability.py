"""The availability re-check, shared by the standalone
POST /checkpoints/{id}/validate route (docs/CHECKPOINT_REGISTRATION_PHASES.md
Phase 5, item 4) and the pre-launch check in `runs/worker.py::_run_one`
(Phase 6) -- one implementation so a route-triggered check and a
run-triggered check write the same three columns the same way (R-D26).

Deliberately narrow (R-D1): this never deletes a row and never writes
any column besides the three availability ones, no matter what
`validate_checkpoint` reports. A row exists because someone registered
it, and it stays exactly that way even when the weights behind it turn
out to be gone -- the availability columns record that, they do not
erase the registration.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint
from app.schemas.checkpoints import CheckpointDetail
from app.schemas.discovery import CheckpointAvailability
from app.services.checkpoints import queries as checkpoints_queries
from app.services.cluster import get_model_discovery


async def refresh_availability(db: AsyncSession, checkpoint: Checkpoint) -> CheckpointAvailability:
    """Re-checks one already-loaded checkpoint's weights and persists
    the result. Takes the `Checkpoint` row itself rather than an id --
    the worker already has one on hand from `load_run_context`, and
    re-fetching it here would be a second query for a row it's already
    holding.

    The caller must ensure no transaction is open before calling this:
    `validate_checkpoint` below is an SSH round trip, and this function
    does not wrap it in one (R-T17, R-T22).
    """
    discovery = get_model_discovery()
    availability = await discovery.validate_checkpoint(checkpoint.path)

    await checkpoints_queries.update_checkpoint_availability(
        db,
        checkpoint.id,
        status=availability.status,
        detail=availability.detail,
        checked_at=availability.checked_at,
    )

    return availability


async def check_availability(db: AsyncSession, checkpoint_id: int) -> CheckpointDetail | None:
    """`None` if `checkpoint_id` names no row, so the router 404s."""
    checkpoint = await checkpoints_queries.get_checkpoint(db, checkpoint_id)
    if checkpoint is None:
        return None

    # Close the read transaction before refresh_availability's SSH call
    # rather than holding it open across the round trip (R-T17).
    await db.commit()

    await refresh_availability(db, checkpoint)

    return await checkpoints_queries.get_checkpoint_with_runs(db, checkpoint_id)
