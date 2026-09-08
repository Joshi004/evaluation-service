"""Standards controller -- orchestrates the loader/query calls and shapes
the response: attaches decision D4's per-field warning and the recipe's
raw YAML source text, neither of which the `recipe` table stores. See
.cursor/rules/backend-layering.mdc.
"""

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Recipe
from app.schemas.standards import RecipeFieldWarning, StandardRecipe
from app.services.recipes import queries as recipes_queries
from app.services.standards import loader as standards_loader
from app.services.standards.capabilities import FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS


async def list_standards(db: AsyncSession) -> list[StandardRecipe]:
    standards_dir = Path(get_settings().standards_dir)
    recipes = await recipes_queries.list_standards(db)
    return [_to_standard_recipe(recipe, standards_dir) for recipe in recipes]


async def reload_standards(db: AsyncSession) -> list[StandardRecipe]:
    standards_dir = Path(get_settings().standards_dir)
    await standards_loader.load_all(standards_dir, db)
    recipes = await recipes_queries.list_standards(db)
    return [_to_standard_recipe(recipe, standards_dir) for recipe in recipes]


def _build_warnings(recipe: Recipe) -> list[RecipeFieldWarning]:
    """Decision D4: a value a framework silently drops is recorded, not
    rejected -- but flagged here so it's visible wherever the recipe is
    shown to a human.
    """
    warnings = []
    unsupported_fields = FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS.get(recipe.framework, set())
    if "min_p" in unsupported_fields and recipe.min_p != 0.0:
        warnings.append(
            RecipeFieldWarning(
                field="min_p",
                message="not forwarded by evalscope's openai_api path — recorded, has no effect",
            )
        )
    return warnings


def _to_standard_recipe(recipe: Recipe, standards_dir: Path) -> StandardRecipe:
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
        warnings=_build_warnings(recipe),
        source_yaml=standards_loader.read_source_yaml(standards_dir, recipe.label),
    )
