"""Recipe queries -- the only DB access against the `recipe` table.

Used by the recipes resource itself (app.api.v1.recipes ->
app.controllers.recipes -> here) and, from Phase 2 on, by
app.services.standards (the loader and resolve_recipe both read/write
`recipe` rows) -- per .cursor/rules/backend-layering.mdc, a library
module reusing another library module's DB access is normal composition,
and it keeps every query against this table in one file.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Recipe
from app.schemas.recipes import RecipeListItem


async def list_recipes(db: AsyncSession) -> list[RecipeListItem]:
    """Every recipe ever hashed, standard or ad-hoc override alike."""
    stmt = select(Recipe).order_by(Recipe.benchmark, Recipe.created_at)
    recipes = (await db.execute(stmt)).scalars().all()
    return [
        RecipeListItem(
            id=recipe.id,
            hash=recipe.hash,
            label=recipe.label,
            benchmark=recipe.benchmark,
            framework=recipe.framework,
            task_name=recipe.task_name,
            created_at=recipe.created_at,
        )
        for recipe in recipes
    ]


async def list_standards(db: AsyncSession) -> list[Recipe]:
    """Recipes loaded from reviewed YAML -- the Standards page's whole
    filter (docs/IMPLEMENTATION_PHASES.md Phase 2, item 5). A row minted
    from a user override at submit time (Phase 6) has `label = NULL` and
    never appears here.
    """
    stmt = select(Recipe).where(Recipe.label.is_not(None)).order_by(Recipe.benchmark, Recipe.label)
    return list((await db.execute(stmt)).scalars().all())


async def get_recipe_by_hash(db: AsyncSession, hash_value: str) -> Recipe | None:
    """The identity lookup the hash exists for: same content, same row."""
    stmt = select(Recipe).where(Recipe.hash == hash_value)
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_recipe(db: AsyncSession, recipe_id: int) -> Recipe | None:
    """The plain-id lookup submit.py needs for a recipe named in a
    request body -- get_recipe_by_hash is the identity lookup used
    internally by the loader and resolve_recipe, a different key for a
    different caller.
    """
    return await db.get(Recipe, recipe_id)


async def insert_recipe(
    db: AsyncSession, config: dict[str, Any], hash_value: str, label: str | None
) -> Recipe:
    """Insert a new, immutable recipe row. `config` must be exactly the
    key set `Recipe.as_hashable_dict()` produces -- built via `**config`
    so any drift between a caller's dict and the model's actual columns
    fails loudly (TypeError) rather than silently hashing the wrong
    thing.
    """
    recipe = Recipe(**config, hash=hash_value, label=label)
    db.add(recipe)
    await db.flush()  # populates recipe.id via Postgres RETURNING
    await db.commit()
    return recipe
