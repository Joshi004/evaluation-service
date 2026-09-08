"""Served-endpoint controller -- validates + delegates, no DB access.
See .cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.endpoints import EndpointListItem
from app.services.endpoints import lifecycle
from app.services.endpoints import queries as endpoints_service


async def list_endpoints(db: AsyncSession) -> list[EndpointListItem]:
    return await endpoints_service.list_live_endpoints(db)


async def start_endpoint(db: AsyncSession, checkpoint_id: int) -> EndpointListItem | None:
    """None means the checkpoint doesn't exist -- the router 404s.
    lifecycle.ServerDiedError / ReadinessTimeoutError propagate past
    this unchanged; the router maps those to 502 / 504.
    """
    checkpoint_and_profile = await endpoints_service.get_checkpoint_and_serving_profile(
        db, checkpoint_id
    )
    if checkpoint_and_profile is None:
        return None
    checkpoint, serving_profile = checkpoint_and_profile

    endpoint = await lifecycle.start_or_reuse_endpoint(db, checkpoint, serving_profile)
    # checkpoint.name / serving_profile.gpus are already in hand from the
    # fetch above, so shaping the response here costs no extra query.
    return EndpointListItem(
        id=endpoint.id,
        checkpoint_id=endpoint.checkpoint_id,
        checkpoint_name=checkpoint.name,
        serving_profile_id=endpoint.serving_profile_id,
        gpus=serving_profile.gpus,
        slurm_job_id=endpoint.slurm_job_id,
        url=endpoint.url,
        expires_at=endpoint.expires_at,
        created_at=endpoint.created_at,
    )


async def kill_endpoint(db: AsyncSession, endpoint_id: int) -> bool:
    """True if a row was found and killed; False -- the router 404s."""
    endpoint = await lifecycle.kill_endpoint(db, endpoint_id)
    return endpoint is not None
