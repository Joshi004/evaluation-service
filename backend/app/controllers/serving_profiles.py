"""Serving-profile controller -- currently a single read-only listing
for the profile picker (Phase 5). See .cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.serving_profiles import ServingProfileSummary
from app.services.serving_profiles import queries as serving_profiles_service


async def list_serving_profiles(db: AsyncSession) -> list[ServingProfileSummary]:
    return await serving_profiles_service.list_serving_profiles(db)
