"""`resolve_standard` -- the override mechanism for a benchmark's
protocol fields (docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.6,
Phase 3). Built here because it shares `get_standard_by_hash` and
`insert_standard` with the loader and is the same code path in
miniature.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Standard
from app.services.standards import queries as standards_queries
from app.services.standards.hashing import standard_hash


async def resolve_standard(db: AsyncSession, base: Standard, overrides: dict[str, Any]) -> Standard:
    """A user override is not a special case. It's just a different standard."""
    config = base.as_hashable_dict() | overrides
    hash_value = standard_hash(config)
    existing = await standards_queries.get_standard_by_hash(db, hash_value)
    if existing:
        return existing
    # eval_batch_size / request_timeout_seconds are never part of
    # `overrides` (a submit only overrides hashed protocol fields, per
    # StandardOverrides) and never part of the hash, so there is nothing
    # for an override to say about them. The new row inherits the base
    # standard's current operational values rather than silently
    # falling back to insert_standard's column defaults.
    unhashed_config = {
        "eval_batch_size": base.eval_batch_size,
        "request_timeout_seconds": base.request_timeout_seconds,
    }
    return await standards_queries.insert_standard(
        db, config | unhashed_config, hash_value, label=None
    )
