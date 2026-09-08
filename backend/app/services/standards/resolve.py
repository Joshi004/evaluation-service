"""`resolve_recipe` -- the whole override mechanism (docs/IMPLEMENTATION_PHASES.md
Section 0.6). Not called anywhere yet: Phase 6 builds the Submit override
editor that calls this. Built here because it shares `get_recipe_by_hash`
and `insert_recipe` with the loader and is the same code path in miniature.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Recipe
from app.services.recipes import queries as recipes_queries
from app.services.recipes.hashing import recipe_hash


async def resolve_recipe(db: AsyncSession, base: Recipe, overrides: dict[str, Any]) -> Recipe:
    """A user override is not a special case. It's just a different recipe."""
    config = base.as_hashable_dict() | overrides
    hash_value = recipe_hash(config)
    existing = await recipes_queries.get_recipe_by_hash(db, hash_value)
    if existing:
        return existing
    return await recipes_queries.insert_recipe(db, config, hash_value, label=None)
