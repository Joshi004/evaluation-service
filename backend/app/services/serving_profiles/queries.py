"""Serving-profile queries -- the only DB access against the
`serving_profile` table, per .cursor/rules/backend-layering.mdc. Used by
`resolve.py` here today; from Phase 5 on, also by the GET
/serving-profiles route and checkpoint registration.
`get_serving_profile_by_label` and `list_all_serving_profiles` (Phase 1,
docs/STANDARDS_AND_PROFILES_PHASES.md) exist for
`app.services.serving_profiles.repository`, the `CatalogRepository`
implementation the generic catalog loader drives.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ServingProfile
from app.schemas.serving_profiles import ServingProfileConfig, ServingProfileSummary


async def list_serving_profiles(db: AsyncSession) -> list[ServingProfileSummary]:
    """Every serving profile ever hashed, labelled standard or ad-hoc
    customisation alike -- mirrors `standards.queries.list_standards`.
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


async def list_all_serving_profiles(db: AsyncSession) -> list[ServingProfile]:
    """Every serving profile row, as ORM rows rather than
    `list_serving_profiles`'s `ServingProfileSummary` DTOs --
    `CatalogRepository.list_all` needs a row's `id`/`hash`/`label`
    directly, and a `catalog-status` report has no reason to shape a
    full summary for a row a file might not even claim.
    """
    stmt = select(ServingProfile).order_by(ServingProfile.id)
    return list((await db.execute(stmt)).scalars().all())


async def get_serving_profile_by_hash(db: AsyncSession, hash_value: str) -> ServingProfile | None:
    """The identity lookup the hash exists for: same content, same row."""
    stmt = select(ServingProfile).where(ServingProfile.hash == hash_value)
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_serving_profile_by_label(db: AsyncSession, label: str) -> ServingProfile | None:
    """The label-conflict lookup the catalog loader needs (S-T3).
    `serving_profile.label` is `UNIQUE`, so `scalar_one_or_none()` is
    safe here -- more than one row sharing a label is not a state the
    database allows.
    """
    stmt = select(ServingProfile).where(ServingProfile.label == label)
    return (await db.execute(stmt)).scalar_one_or_none()


async def insert_serving_profile(
    db: AsyncSession, config: ServingProfileConfig, hash_value: str, label: str | None = None
) -> ServingProfile:
    """Insert a new, immutable serving profile row. `label` defaults to
    `None` because `resolve_serving_profile` mints one from a bare
    `ServingProfileConfig` with no label of its own, and every profile
    it inserts is, by definition, an ad-hoc customisation rather than a
    reviewed standard (R-D16) -- that defaulted parameter is the entire
    widening this phase makes here (S-T4). The only caller that ever
    passes a real label is `app.services.serving_profiles.repository`,
    loading a reviewed `catalog/serving-profiles/*.yaml` file. Built via
    `**config.model_dump()` so any drift between `ServingProfileConfig`'s
    fields and the model's actual columns fails loudly (`TypeError`)
    rather than silently hashing the wrong thing.
    """
    profile = ServingProfile(**config.model_dump(), hash=hash_value, label=label)
    db.add(profile)
    await db.flush()  # populates profile.id via Postgres RETURNING
    await db.commit()
    return profile
