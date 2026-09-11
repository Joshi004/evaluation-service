"""`SamplingProfilesRepository` -- the `CatalogRepository` implementation
over the `sampling_profile` table (docs/STANDARDS_AND_PROFILES_PHASES.md
Phase 2). The generic loader in `app.services.catalog.loader` reads and
writes `sampling_profile` rows only through this class.
"""

from collections.abc import Sequence
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SamplingProfile
from app.schemas.sampling_profiles import SamplingProfileConfig, SamplingProfileDocument
from app.services.sampling_profiles import queries as sampling_profiles_queries


class SamplingProfilesRepository:
    """A `CatalogRepository[SamplingProfile]` over
    `sampling_profiles.queries` -- no explicit inheritance needed, since
    `CatalogRepository` is a `Protocol` (structural typing).
    """

    name = "sampling-profiles"
    directory_name = "sampling-profiles"
    document_model = SamplingProfileDocument

    async def get_by_hash(self, db: AsyncSession, hash_value: str) -> SamplingProfile | None:
        return await sampling_profiles_queries.get_sampling_profile_by_hash(db, hash_value)

    async def get_by_label(self, db: AsyncSession, label: str) -> SamplingProfile | None:
        return await sampling_profiles_queries.get_sampling_profile_by_label(db, label)

    async def get_by_id(self, db: AsyncSession, row_id: int) -> SamplingProfile | None:
        return await sampling_profiles_queries.get_sampling_profile(db, row_id)

    async def list_all(self, db: AsyncSession) -> list[SamplingProfile]:
        return await sampling_profiles_queries.list_all_sampling_profiles(db)

    async def insert(
        self, db: AsyncSession, config: dict[str, Any], hash_value: str, label: str
    ) -> SamplingProfile:
        # Re-validated through SamplingProfileConfig rather than passed
        # straight through: any drift between SamplingProfileDocument's
        # key set and SamplingProfileConfig's own fields must fail
        # loudly here, not silently store the wrong thing.
        validated_config = SamplingProfileConfig(**config)
        return await sampling_profiles_queries.insert_sampling_profile(
            db, validated_config, hash_value, label
        )

    async def sync_unhashed_columns(
        self, db: AsyncSession, row: SamplingProfile, unhashed_config: dict[str, Any]
    ) -> None:
        """No-op: every `sampling_profile` column is part of the hash
        (S-D7 carves out no exception here), so a hash hit already means
        nothing on this row needs to change.
        """
        return None

    async def referencing_counts(
        self, db: AsyncSession, row_ids: Sequence[int]
    ) -> dict[int, dict[str, int]]:
        return await sampling_profiles_queries.get_sampling_profile_referencing_counts(db, row_ids)

    async def delete(self, db: AsyncSession, row: SamplingProfile) -> None:
        await sampling_profiles_queries.delete_sampling_profile(db, row)


# One instance, imported directly by callers -- no factory function
# needed, because there is no second implementation to choose between.
sampling_profiles_repository = SamplingProfilesRepository()
