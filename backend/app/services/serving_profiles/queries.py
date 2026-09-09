"""Serving-profile queries -- the only DB access against the
`serving_profile` table, per .cursor/rules/backend-layering.mdc. Used by
`resolve.py` here today; from Phase 5 on, also by the GET
/serving-profiles route and checkpoint registration.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ServingProfile
from app.schemas.serving_profiles import ServingProfileConfig, ServingProfileSummary


async def list_serving_profiles(db: AsyncSession) -> list[ServingProfileSummary]:
    """Every serving profile ever hashed, labelled standard or ad-hoc
    customisation alike -- mirrors `recipes.queries.list_recipes`.
    """
    stmt = select(ServingProfile).order_by(ServingProfile.created_at)
    profiles = (await db.execute(stmt)).scalars().all()
    return [
        ServingProfileSummary(
            id=profile.id,
            hash=profile.hash,
            label=profile.label,
            engine=profile.engine,
            engine_version=profile.engine_version,
            gpus=profile.gpus,
            tensor_parallel_size=profile.tensor_parallel_size,
            pipeline_parallel_size=profile.pipeline_parallel_size,
            max_model_len=profile.max_model_len,
            reasoning_parser=profile.reasoning_parser,
            dtype=profile.dtype,
            quantization=profile.quantization,
            gpu_memory_utilization=profile.gpu_memory_utilization,
            engine_options=profile.engine_options,
        )
        for profile in profiles
    ]


async def get_serving_profile(db: AsyncSession, serving_profile_id: int) -> ServingProfile | None:
    return await db.get(ServingProfile, serving_profile_id)


async def get_serving_profile_by_hash(db: AsyncSession, hash_value: str) -> ServingProfile | None:
    """The identity lookup the hash exists for: same content, same row."""
    stmt = select(ServingProfile).where(ServingProfile.hash == hash_value)
    return (await db.execute(stmt)).scalar_one_or_none()


async def insert_serving_profile(
    db: AsyncSession, config: ServingProfileConfig, hash_value: str
) -> ServingProfile:
    """Insert a new, immutable serving profile row with `label=None` --
    `resolve_serving_profile` is the only caller, and every profile it
    inserts is, by definition, an ad-hoc customisation rather than a
    reviewed standard (R-D16). Built via `**config.model_dump()` so any
    drift between `ServingProfileConfig`'s fields and the model's actual
    columns fails loudly (`TypeError`) rather than silently hashing the
    wrong thing.
    """
    profile = ServingProfile(**config.model_dump(), hash=hash_value, label=None)
    db.add(profile)
    await db.flush()  # populates profile.id via Postgres RETURNING
    await db.commit()
    return profile
