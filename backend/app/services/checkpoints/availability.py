"""The standalone availability re-check -- POST /checkpoints/{id}/validate.
See docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 5, item 4.

Deliberately narrow (R-D1): this never deletes a row and never writes
any column besides the three availability ones, no matter what
`validate_checkpoint` reports. A row exists because someone registered
it, and it stays exactly that way even when the weights behind it turn
out to be gone -- the availability columns record that, they do not
erase the registration.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.checkpoints import CheckpointDetail
from app.services.checkpoints import queries as checkpoints_queries
from app.services.cluster import get_model_discovery


async def check_availability(db: AsyncSession, checkpoint_id: int) -> CheckpointDetail | None:
    """`None` if `checkpoint_id` names no row, so the router 404s."""
    checkpoint = await checkpoints_queries.get_checkpoint(db, checkpoint_id)
    if checkpoint is None:
        return None
    path = checkpoint.path

    # Close the read transaction before the SSH call below rather than
    # holding it open across the round trip (R-T17).
    await db.commit()

    discovery = get_model_discovery()
    availability = await discovery.validate_checkpoint(path)

    await checkpoints_queries.update_checkpoint_availability(
        db,
        checkpoint_id,
        status=availability.status,
        detail=availability.detail,
        checked_at=availability.checked_at,
    )

    return await checkpoints_queries.get_checkpoint_with_runs(db, checkpoint_id)
