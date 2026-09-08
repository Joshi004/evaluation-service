"""Recipe endpoints: list every recipe ever hashed.

Renamed from benchmarks.py (decision in docs/IMPLEMENTATION_PHASES.md) --
"recipe" is the schema's actual name for this resource.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import recipes as recipes_controller
from app.db import get_db
from app.schemas.recipes import RecipeListItem

router = APIRouter()


@router.get("", response_model=list[RecipeListItem])
async def list_recipes(db: AsyncSession = Depends(get_db)) -> list[RecipeListItem]:
    return await recipes_controller.list_recipes(db)
