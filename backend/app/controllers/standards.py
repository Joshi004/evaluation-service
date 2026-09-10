"""Standards controller -- orchestrates the catalog loader/query calls
and shapes the response: attaches decision D4's per-field warning and
the recipe's raw YAML source text, neither of which the `recipe` table
stores. See .cursor/rules/backend-layering.mdc.
"""

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Recipe
from app.schemas.catalog import CatalogStatus
from app.schemas.standards import StandardRecipe
from app.services.catalog import loader as catalog_loader
from app.services.recipes import queries as recipes_queries
from app.services.standards.capabilities import sampling_field_warnings
from app.services.standards.repository import standards_repository


async def list_standards(db: AsyncSession) -> list[StandardRecipe]:
    catalog_dir = Path(get_settings().catalog_dir)
    recipes = await recipes_queries.list_standards(db)
    return [_to_standard_recipe(recipe, catalog_dir) for recipe in recipes]


async def reload_standards(db: AsyncSession) -> list[StandardRecipe]:
    catalog_dir = Path(get_settings().catalog_dir)
    await catalog_loader.load_catalog(db, catalog_dir, standards_repository)
    recipes = await recipes_queries.list_standards(db)
    return [_to_standard_recipe(recipe, catalog_dir) for recipe in recipes]


async def get_catalog_status(db: AsyncSession) -> CatalogStatus:
    catalog_dir = Path(get_settings().catalog_dir)
    return await catalog_loader.catalog_status(db, catalog_dir, standards_repository)


def _to_standard_recipe(recipe: Recipe, catalog_dir: Path) -> StandardRecipe:
    assert recipe.label is not None  # guaranteed by list_standards' WHERE clause
    return StandardRecipe(
        id=recipe.id,
        hash=recipe.hash,
        label=recipe.label,
        benchmark=recipe.benchmark,
        framework=recipe.framework,
        framework_image=recipe.framework_image,
        task_name=recipe.task_name,
        dataset_name=recipe.dataset_name,
        dataset_revision=recipe.dataset_revision,
        split=recipe.split,
        few_shot=recipe.few_shot,
        prompt_template=recipe.prompt_template,
        extraction=recipe.extraction,
        metrics=recipe.metrics,
        repeats=recipe.repeats,
        sample_limit=recipe.sample_limit,
        temperature=recipe.temperature,
        top_p=recipe.top_p,
        top_k=recipe.top_k,
        min_p=recipe.min_p,
        presence_penalty=recipe.presence_penalty,
        repetition_penalty=recipe.repetition_penalty,
        max_tokens=recipe.max_tokens,
        enable_thinking=recipe.enable_thinking,
        think_handling=recipe.think_handling,
        created_at=recipe.created_at,
        warnings=sampling_field_warnings(recipe.framework, recipe.as_hashable_dict()),
        source_yaml=catalog_loader.read_source_yaml(
            catalog_dir, standards_repository, recipe.label
        ),
    )
