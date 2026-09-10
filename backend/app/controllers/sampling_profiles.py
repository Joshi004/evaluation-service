"""Sampling-profile controller -- the read-only listing (mirrors the
serving-profile picker's shape, ahead of Phase 7's own picker), plus the
catalog reload and dry-run status routes. See
.cursor/rules/backend-layering.mdc and
docs/STANDARDS_AND_PROFILES_PHASES.md Phase 2, item 9.
"""

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.schemas.catalog import CatalogStatus
from app.schemas.sampling_profiles import SamplingProfileSummary
from app.services.catalog import loader as catalog_loader
from app.services.sampling_profiles import queries as sampling_profiles_service
from app.services.sampling_profiles.repository import sampling_profiles_repository


async def list_sampling_profiles(db: AsyncSession) -> list[SamplingProfileSummary]:
    return await sampling_profiles_service.list_sampling_profiles(db)


async def reload_sampling_profiles(db: AsyncSession) -> list[SamplingProfileSummary]:
    catalog_dir = Path(get_settings().catalog_dir)
    await catalog_loader.load_catalog(db, catalog_dir, sampling_profiles_repository)
    return await sampling_profiles_service.list_sampling_profiles(db)


async def get_catalog_status(db: AsyncSession) -> CatalogStatus:
    catalog_dir = Path(get_settings().catalog_dir)
    return await catalog_loader.catalog_status(db, catalog_dir, sampling_profiles_repository)
