"""Live-endpoint queries -- the only DB access for the endpoints
resource (app.api.v1.endpoints -> app.controllers.endpoints -> here),
per .cursor/rules/backend-layering.mdc.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.models import Checkpoint, Endpoint, ServingProfile
from app.schemas.endpoints import EndpointListItem


async def list_live_endpoints(db: AsyncSession) -> list[EndpointListItem]:
    """Endpoints that haven't expired yet, soonest-expiring first. Joins
    in the checkpoint name and GPU count so the Endpoints page can show
    both without a second round trip -- the per-row GPU count is what
    makes "the GPUs a submit costs" (Phase 3) countable by eye.
    """
    stmt = (
        select(Endpoint, Checkpoint.name, ServingProfile.gpus)
        .join(Checkpoint, Endpoint.checkpoint_id == Checkpoint.id)
        .join(ServingProfile, Endpoint.serving_profile_id == ServingProfile.id)
        .where(Endpoint.expires_at > func.now())
        .order_by(Endpoint.expires_at)
    )
    rows = (await db.execute(stmt)).all()
    return [
        EndpointListItem(
            id=endpoint.id,
            checkpoint_id=endpoint.checkpoint_id,
            checkpoint_name=checkpoint_name,
            serving_profile_id=endpoint.serving_profile_id,
            gpus=gpus,
            slurm_job_id=endpoint.slurm_job_id,
            url=endpoint.url,
            expires_at=endpoint.expires_at,
            created_at=endpoint.created_at,
        )
        for endpoint, checkpoint_name, gpus in rows
    ]


async def get_checkpoint_and_serving_profile(
    db: AsyncSession, checkpoint_id: int
) -> tuple[Checkpoint, ServingProfile] | None:
    """The raw ORM rows the endpoint lifecycle needs to build a serve
    script. Unlike checkpoints/queries.py (which returns response DTOs
    for the checkpoints resource), this returns the models themselves,
    for internal use -- starting an endpoint is the only caller.
    """
    stmt = (
        select(Checkpoint, ServingProfile)
        .join(ServingProfile, Checkpoint.serving_profile_id == ServingProfile.id)
        .where(Checkpoint.id == checkpoint_id)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return None
    checkpoint, serving_profile = row
    return checkpoint, serving_profile


async def find_reusable_endpoint(
    db: AsyncSession, checkpoint_id: int, serving_profile_id: int
) -> Endpoint | None:
    """The reuse check, run before anything is submitted (Phase 3, item
    5): a cold start is 350s of H100 time, so reusing a live endpoint is
    worth real money. `url IS NOT NULL` is what keeps a row from a failed
    start (SERVER_DIED / READINESS_TIMEOUT) from ever being handed back
    out -- there's no status column, this predicate is the whole check.
    """
    stmt = (
        select(Endpoint)
        .where(
            Endpoint.checkpoint_id == checkpoint_id,
            Endpoint.serving_profile_id == serving_profile_id,
            Endpoint.expires_at > func.now(),
            Endpoint.url.is_not(None),
        )
        .order_by(Endpoint.expires_at.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_endpoint_row(
    db: AsyncSession, checkpoint_id: int, serving_profile_id: int, expires_at: datetime
) -> Endpoint:
    """Written before the serve job is even submitted (Trap T3):
    expires_at is submitted_at + walltime, because the walltime clock
    starts when SLURM starts the job, not when vLLM finishes loading.
    Writing it at ready time would make the row outlive the server by
    ~6 minutes -- exactly the confusing-connection-reset failure this
    column exists to prevent.
    """
    endpoint = Endpoint(
        checkpoint_id=checkpoint_id, serving_profile_id=serving_profile_id, expires_at=expires_at
    )
    db.add(endpoint)
    await db.flush()  # populates endpoint.id via Postgres RETURNING
    await db.commit()
    return endpoint


async def get_endpoint(db: AsyncSession, endpoint_id: int) -> Endpoint | None:
    return await db.get(Endpoint, endpoint_id)


async def set_slurm_job_id(
    db: AsyncSession, endpoint_id: int, slurm_job_id: int
) -> Endpoint | None:
    endpoint = await db.get(Endpoint, endpoint_id)
    if endpoint is None:
        return None
    endpoint.slurm_job_id = slurm_job_id
    await db.commit()
    return endpoint


async def set_endpoint_url(db: AsyncSession, endpoint_id: int, url: str) -> Endpoint | None:
    endpoint = await db.get(Endpoint, endpoint_id)
    if endpoint is None:
        return None
    endpoint.url = url
    await db.commit()
    return endpoint


async def expire_endpoint(db: AsyncSession, endpoint_id: int) -> Endpoint | None:
    """The kill button's write: expires_at = now(). No status column to
    flip -- the reuse query's `expires_at > now()` clause already stops
    this row being handed out again.
    """
    endpoint = await db.get(Endpoint, endpoint_id)
    if endpoint is None:
        return None
    endpoint.expires_at = datetime.now(UTC)
    await db.commit()
    return endpoint
