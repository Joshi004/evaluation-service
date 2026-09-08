"""Served-endpoint controller -- validates + delegates, no DB access.
See .cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.endpoints import EndpointListItem
from app.services.endpoints import queries as endpoints_service


async def list_endpoints(db: AsyncSession) -> list[EndpointListItem]:
    return await endpoints_service.list_live_endpoints(db)
