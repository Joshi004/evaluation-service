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
    return await standards_queries.insert_standard(db, config, hash_value, label=None)
