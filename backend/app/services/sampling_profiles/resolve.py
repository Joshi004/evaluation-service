"""`resolve_sampling_profile` -- the sampling half of the three-layer
merge a run resolves at submit time (docs/STANDARDS_AND_PROFILES_PHASES.md
Section 0.5, Phase 3, S-D4). Mirrors `resolve_serving_profile`
(app/services/serving_profiles/resolve.py) and `resolve_standard`
(app/services/standards/resolve.py) exactly.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SamplingProfile
from app.schemas.sampling_profiles import SamplingProfileConfig
from app.services.sampling_profiles import queries as sampling_profiles_queries
from app.services.sampling_profiles.hashing import sampling_profile_hash


async def resolve_sampling_profile(
    db: AsyncSession,
    base: SamplingProfile,
    standard_overrides: dict[str, Any],
    user_overrides: dict[str, Any],
) -> SamplingProfile:
    """Merge, key by key, in the order S-D4 fixes: what the checkpoint
    speaks like by default (or whichever profile a submit picked
    explicitly), overridden by what the benchmark's standard mandates,
    overridden by what the caller actually asked for. A user override
    is not a special case. It's just a different profile.
    """
    config = base.as_hashable_dict() | standard_overrides | user_overrides
    hash_value = sampling_profile_hash(config)
    existing = await sampling_profiles_queries.get_sampling_profile_by_hash(db, hash_value)
    if existing:
        return existing
    return await sampling_profiles_queries.insert_sampling_profile(
        db, SamplingProfileConfig(**config), hash_value, label=None
    )
