"""`resolve_serving_profile` -- the whole profile-customisation
mechanism, mirroring `resolve_standard` (app/services/standards/resolve.py)
exactly. Two callers: registration's customisation form
(app/services/checkpoints/registration.py), and a submit-time serving
override (app/services/runs/submit.py).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ServingProfile
from app.schemas.serving_profiles import ServingProfileConfig
from app.services.serving_profiles import queries as serving_profiles_queries
from app.services.serving_profiles.hashing import serving_profile_hash


async def resolve_serving_profile(
    db: AsyncSession, config: ServingProfileConfig, label: str | None = None
) -> ServingProfile:
    """A user customisation is not a special case. It's just a different
    profile.

    `label` defaults to `None` (today's ad-hoc behaviour, and every
    caller before this one) and only ever attaches to a row this call
    actually inserts below -- a hash hit returns the existing row
    exactly as it is, labelled or not, since rows are immutable (R-D17)
    and a caller cannot rename one after the fact by resubmitting the
    same config with a label attached.
    """
    hash_value = serving_profile_hash(config.model_dump())
    existing = await serving_profiles_queries.get_serving_profile_by_hash(db, hash_value)
    if existing:
        return existing
    return await serving_profiles_queries.insert_serving_profile(
        db, config, hash_value, label=label
    )
