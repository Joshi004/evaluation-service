"""Serving-profile controller -- the read-only listing for the profile
picker (Phase 5), plus the catalog reload and dry-run status routes
(Phase 1). See .cursor/rules/backend-layering.mdc.
"""

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.schemas.catalog import CatalogStatus
from app.schemas.serving_profiles import ServingProfileSummary
from app.services.catalog import loader as catalog_loader
from app.services.serving_profiles import queries as serving_profiles_service
from app.services.serving_profiles.repository import serving_profiles_repository


async def list_serving_profiles(db: AsyncSession) -> list[ServingProfileSummary]:
    return await serving_profiles_service.list_serving_profiles(db)


async def reload_serving_profiles(db: AsyncSession) -> list[ServingProfileSummary]:
    catalog_dir = Path(get_settings().catalog_dir)
    await catalog_loader.load_catalog(db, catalog_dir, serving_profiles_repository)
    return await serving_profiles_service.list_serving_profiles(db)


async def get_catalog_status(db: AsyncSession) -> CatalogStatus:
    catalog_dir = Path(get_settings().catalog_dir)
    return await catalog_loader.catalog_status(db, catalog_dir, serving_profiles_repository)
