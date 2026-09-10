"""Standard queries -- the only DB access against the `standard` table,
per .cursor/rules/backend-layering.mdc. Used by the standards resource
itself (app.api.v1.standards -> app.controllers.standards -> here), by
`app.services.standards.repository` (the `CatalogRepository`
implementation the generic catalog loader drives), by
`app.services.standards.resolve`, and by the runs submit/preview path.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Standard


async def list_standards(db: AsyncSession, *, include_ad_hoc: bool) -> list[Standard]:
    """Every reviewed standard (`label IS NOT NULL`) by default -- the
    Standards page's own filter. `include_ad_hoc=True` folds in rows
    minted from a submit-time override too, which is what used to be a
    separate list route before Phase 3 merged the two: one table, one
    list endpoint, distinguished by a query parameter rather than by
    which route you called.
    """
    stmt = select(Standard)
    if not include_ad_hoc:
        stmt = stmt.where(Standard.label.is_not(None))
    stmt = stmt.order_by(Standard.benchmark, Standard.created_at)
    return list((await db.execute(stmt)).scalars().all())


async def list_all_standards(db: AsyncSession) -> list[Standard]:
    """Every standard row, reviewed and ad-hoc alike -- what
    `CatalogRepository.list_all` needs so a `catalog-status` report can
    show every row a YAML file doesn't account for.
    """
    stmt = select(Standard).order_by(Standard.id)
    return list((await db.execute(stmt)).scalars().all())


async def get_standard_by_hash(db: AsyncSession, hash_value: str) -> Standard | None:
    """The identity lookup the hash exists for: same content, same row."""
    stmt = select(Standard).where(Standard.hash == hash_value)
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_standard_by_label(db: AsyncSession, label: str) -> Standard | None:
    """The label-conflict lookup the catalog loader needs (S-T3).
    `standard.label` is `UNIQUE` from this phase on (S-D3), so
    `scalar_one_or_none()` is safe here -- more than one row sharing a
    label is not a state the database allows.
    """
    stmt = select(Standard).where(Standard.label == label)
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_standard(db: AsyncSession, standard_id: int) -> Standard | None:
    """The plain-id lookup submit.py needs for a standard named in a
    request body -- get_standard_by_hash is the identity lookup used
    internally by the loader and resolve_standard, a different key for
    a different caller.
    """
    return await db.get(Standard, standard_id)


async def insert_standard(
    db: AsyncSession, config: dict[str, Any], hash_value: str, label: str | None
) -> Standard:
    """Insert a new, immutable standard row. `config` must be exactly
    the key set `Standard.as_hashable_dict()` produces -- built via
    `**config` so any drift between a caller's dict and the model's
    actual columns fails loudly (TypeError) rather than silently hashing
    the wrong thing.
    """
    standard = Standard(**config, hash=hash_value, label=label)
    db.add(standard)
    await db.flush()  # populates standard.id via Postgres RETURNING
    await db.commit()
    return standard
