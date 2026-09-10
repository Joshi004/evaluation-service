"""Sampling-profile queries -- the only DB access against the
`sampling_profile` table, per .cursor/rules/backend-layering.mdc. Used
by `app.services.sampling_profiles.repository` (the `CatalogRepository`
implementation the generic catalog loader drives), the GET
/sampling-profiles route, and checkpoint registration/recommendation.
Mirrors `app.services.serving_profiles.queries` exactly.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SamplingProfile
from app.schemas.sampling_profiles import SamplingProfileConfig, SamplingProfileSummary


async def list_sampling_profiles(db: AsyncSession) -> list[SamplingProfileSummary]:
    """Every sampling profile ever hashed, labelled catalog entry or
    ad-hoc customisation alike -- mirrors
    `serving_profiles.queries.list_serving_profiles`.
    """
    stmt = select(SamplingProfile).order_by(SamplingProfile.created_at)
    profiles = (await db.execute(stmt)).scalars().all()
    return [
        SamplingProfileSummary(
            id=profile.id,
            hash=profile.hash,
            label=profile.label,
            temperature=profile.temperature,
            top_p=profile.top_p,
            top_k=profile.top_k,
            min_p=profile.min_p,
            presence_penalty=profile.presence_penalty,
            repetition_penalty=profile.repetition_penalty,
            max_tokens=profile.max_tokens,
            enable_thinking=profile.enable_thinking,
            seed=profile.seed,
        )
        for profile in profiles
    ]


async def get_sampling_profile(
    db: AsyncSession, sampling_profile_id: int
) -> SamplingProfile | None:
    return await db.get(SamplingProfile, sampling_profile_id)


async def list_all_sampling_profiles(db: AsyncSession) -> list[SamplingProfile]:
    """Every sampling profile row, as ORM rows rather than
    `list_sampling_profiles`'s `SamplingProfileSummary` DTOs --
    `CatalogRepository.list_all` needs a row's `id`/`hash`/`label`
    directly, and a `catalog-status` report has no reason to shape a
    full summary for a row a file might not even claim.
    """
    stmt = select(SamplingProfile).order_by(SamplingProfile.id)
    return list((await db.execute(stmt)).scalars().all())


async def get_sampling_profile_by_hash(db: AsyncSession, hash_value: str) -> SamplingProfile | None:
    """The identity lookup the hash exists for: same content, same row."""
    stmt = select(SamplingProfile).where(SamplingProfile.hash == hash_value)
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_sampling_profile_by_label(db: AsyncSession, label: str) -> SamplingProfile | None:
    """The label-conflict lookup the catalog loader needs (S-T3).
    `sampling_profile.label` is `UNIQUE` from day one (S-D3), so
    `scalar_one_or_none()` is safe here -- more than one row sharing a
    label is not a state the database allows.
    """
    stmt = select(SamplingProfile).where(SamplingProfile.label == label)
    return (await db.execute(stmt)).scalar_one_or_none()


async def insert_sampling_profile(
    db: AsyncSession, config: SamplingProfileConfig, hash_value: str, label: str | None = None
) -> SamplingProfile:
    """Insert a new, immutable sampling profile row. `label` defaults to
    `None` because a future resolve step (Phase 3) mints one from a bare
    `SamplingProfileConfig` with no label of its own -- every profile it
    inserts is, by definition, an ad-hoc customisation rather than a
    reviewed catalog entry. The only caller that passes a real label
    today is `app.services.sampling_profiles.repository`, loading a
    reviewed `catalog/sampling-profiles/*.yaml` file. Built via
    `**config.model_dump()` so any drift between `SamplingProfileConfig`'s
    fields and the model's actual columns fails loudly (`TypeError`)
    rather than silently hashing the wrong thing.
    """
    profile = SamplingProfile(**config.model_dump(), hash=hash_value, label=label)
    db.add(profile)
    await db.flush()  # populates profile.id via Postgres RETURNING
    await db.commit()
    return profile
