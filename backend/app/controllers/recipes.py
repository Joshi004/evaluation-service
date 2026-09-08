"""Recipe controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.recipes import RecipeListItem
from app.services.recipes import queries as recipes_service


async def list_recipes(db: AsyncSession) -> list[RecipeListItem]:
    return await recipes_service.list_recipes(db)
