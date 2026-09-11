"""`ServingProfilesRepository` -- the `CatalogRepository` implementation
over the `serving_profile` table (docs/STANDARDS_AND_PROFILES_PHASES.md
Phase 1). The generic loader in `app.services.catalog.loader` reads and
writes `serving_profile` rows only through this class.
"""

from collections.abc import Sequence
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ServingProfile
from app.schemas.serving_profiles import ServingProfileConfig, ServingProfileDocument
from app.services.serving_profiles import queries as serving_profiles_queries


class ServingProfilesRepository:
    """A `CatalogRepository[ServingProfile]` over
    `serving_profiles.queries` -- no explicit inheritance needed, since
    `CatalogRepository` is a `Protocol` (structural typing).
    """

    name = "serving-profiles"
    directory_name = "serving-profiles"
    document_model = ServingProfileDocument

    async def get_by_hash(self, db: AsyncSession, hash_value: str) -> ServingProfile | None:
        return await serving_profiles_queries.get_serving_profile_by_hash(db, hash_value)

    async def get_by_label(self, db: AsyncSession, label: str) -> ServingProfile | None:
        return await serving_profiles_queries.get_serving_profile_by_label(db, label)

    async def get_by_id(self, db: AsyncSession, row_id: int) -> ServingProfile | None:
        return await serving_profiles_queries.get_serving_profile(db, row_id)

    async def list_all(self, db: AsyncSession) -> list[ServingProfile]:
        return await serving_profiles_queries.list_all_serving_profiles(db)

    async def insert(
        self, db: AsyncSession, config: dict[str, Any], hash_value: str, label: str
    ) -> ServingProfile:
        # Re-validated through ServingProfileConfig rather than passed
        # straight through: any drift between ServingProfileDocument's
        # key set and ServingProfileConfig's own fields must fail loudly
        # here, not silently store the wrong thing.
        validated_config = ServingProfileConfig(**config)
        return await serving_profiles_queries.insert_serving_profile(
            db, validated_config, hash_value, label
        )

    async def sync_unhashed_columns(
        self, db: AsyncSession, row: ServingProfile, unhashed_config: dict[str, Any]
    ) -> None:
        """No-op: every `serving_profile` column is part of the hash
        (S-D7 carves out no exception here), so a hash hit already means
        nothing on this row needs to change.
        """
        return None

    async def referencing_counts(
        self, db: AsyncSession, row_ids: Sequence[int]
    ) -> dict[int, dict[str, int]]:
        return await serving_profiles_queries.get_serving_profile_referencing_counts(db, row_ids)

    async def delete(self, db: AsyncSession, row: ServingProfile) -> None:
        await serving_profiles_queries.delete_serving_profile(db, row)


# One instance, imported directly by callers -- no factory function
# needed (unlike `app.services.cluster.get_cluster_runtime()`), because
# there is no second implementation to choose between.
serving_profiles_repository = ServingProfilesRepository()
