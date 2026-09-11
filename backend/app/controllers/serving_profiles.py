"""Serving-profile controller -- the read-only listing for the profile
picker (Phase 5), plus the catalog reload and dry-run status routes
(Phase 1). See .cursor/rules/backend-layering.mdc.
"""

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.schemas.catalog import CatalogPruneResult, CatalogStatus
from app.schemas.serving_profiles import ServingProfileSummary
from app.services.catalog import deletion as catalog_deletion
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


async def delete_serving_profile(db: AsyncSession, serving_profile_id: int) -> bool:
    """`False` for an unknown id (router: 404). Raises
    `DeletionBlockedError`, uncaught here -- the router maps it to 409,
    the same layer `SubmitValidationError` -> 400 already uses.
    """
    catalog_dir = Path(get_settings().catalog_dir)
    return await catalog_deletion.delete_catalog_row(
        db, catalog_dir, serving_profiles_repository, serving_profile_id
    )


async def prune_serving_profiles(db: AsyncSession) -> CatalogPruneResult:
    deleted_ids = await catalog_deletion.prune_ad_hoc_rows(db, serving_profiles_repository)
    return CatalogPruneResult(deleted_ids=deleted_ids)
