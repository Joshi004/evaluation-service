"""Recipe queries -- the only DB access for the recipes resource
(app.api.v1.recipes -> app.controllers.recipes -> here), per
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Recipe
from app.schemas.recipes import RecipeListItem


async def list_recipes(db: AsyncSession) -> list[RecipeListItem]:
    """Every recipe ever hashed. Empty this phase -- Phase 2 is what
    loads /standards YAML into this table.
    """
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
