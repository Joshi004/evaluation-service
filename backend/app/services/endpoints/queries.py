"""Live-endpoint queries -- the only DB access for the endpoints
resource (app.api.v1.endpoints -> app.controllers.endpoints -> here),
per .cursor/rules/backend-layering.mdc.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.models import Endpoint
from app.schemas.endpoints import EndpointListItem


async def list_live_endpoints(db: AsyncSession) -> list[EndpointListItem]:
    """Endpoints that haven't expired yet, soonest-expiring first. Empty
    this phase -- no endpoint rows are written until Phase 3 starts a
    vLLM server on the cluster.
    """
    stmt = select(Endpoint).where(Endpoint.expires_at > func.now()).order_by(Endpoint.expires_at)
    live_endpoints = (await db.execute(stmt)).scalars().all()
    return [
        EndpointListItem(
            id=endpoint.id,
            checkpoint_id=endpoint.checkpoint_id,
            serving_profile_id=endpoint.serving_profile_id,
            slurm_job_id=endpoint.slurm_job_id,
            url=endpoint.url,
            expires_at=endpoint.expires_at,
            created_at=endpoint.created_at,
        )
        for endpoint in live_endpoints
    ]
