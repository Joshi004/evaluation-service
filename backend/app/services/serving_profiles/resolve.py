"""`resolve_serving_profile` -- the whole profile-customisation
mechanism, mirroring `resolve_recipe` (app/services/standards/resolve.py)
exactly. Not called anywhere yet: Phase 5's registration flow calls this
for a customised profile.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ServingProfile
from app.schemas.serving_profiles import ServingProfileConfig
from app.services.serving_profiles import queries as serving_profiles_queries
from app.services.serving_profiles.hashing import serving_profile_hash


async def resolve_serving_profile(db: AsyncSession, config: ServingProfileConfig) -> ServingProfile:
    """A user customisation is not a special case. It's just a different profile."""
    hash_value = serving_profile_hash(config.model_dump())
    existing = await serving_profiles_queries.get_serving_profile_by_hash(db, hash_value)
    if existing:
        return existing
    return await serving_profiles_queries.insert_serving_profile(db, config, hash_value)
