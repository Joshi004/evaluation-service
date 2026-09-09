"""POST /runs' whole submit path (docs/IMPLEMENTATION_PHASES.md Phase 5,
item 1): validate every (checkpoint, recipe) pair in the submitted grid
up front, resolve each recipe only if every pair passes, then create one
run_group and one queued eval_run per pair.

Validating before resolving is deliberate: resolve_recipe mints a new,
immutable recipe row the moment an override's content is new, so a
rejected submit must never leave one behind.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint, Recipe, ServingProfile
from app.schemas.runs import RunSubmission
from app.services.compatibility.validator import validate_compatibility
from app.services.endpoints import queries as endpoints_queries
from app.services.recipes import queries as recipes_queries
from app.services.runs import queries as runs_queries
from app.services.standards.resolve import resolve_recipe


class SubmitValidationError(Exception):
    """A submit that would fail predictably -- minutes into a cold start
    -- rather than at request time. The router maps this to a 400.
    """


async def load_checkpoints_and_profiles(
    db: AsyncSession, checkpoint_ids: list[int]
) -> list[tuple[Checkpoint, ServingProfile]] | None:
    """None if any checkpoint_id doesn't exist, so the caller's router
    can 404. Shared with `preview.py`'s read-only `preview_runs` (Phase
    6) so the two can never resolve a grid's checkpoints differently.
    """
    checkpoints_and_profiles: list[tuple[Checkpoint, ServingProfile]] = []
    for checkpoint_id in checkpoint_ids:
        checkpoint_and_profile = await endpoints_queries.get_checkpoint_and_serving_profile(
            db, checkpoint_id
        )
        if checkpoint_and_profile is None:
            return None
        checkpoints_and_profiles.append(checkpoint_and_profile)
    return checkpoints_and_profiles


async def load_base_recipes(db: AsyncSession, recipe_ids: list[int]) -> list[Recipe] | None:
    """None if any recipe_id doesn't exist -- see
    `load_checkpoints_and_profiles`, its sibling for the other half of
    the grid.
    """
    base_recipes: list[Recipe] = []
    for recipe_id in recipe_ids:
        base_recipe = await recipes_queries.get_recipe(db, recipe_id)
        if base_recipe is None:
            return None
        base_recipes.append(base_recipe)
    return base_recipes


async def submit_runs(
    db: AsyncSession,
    name: str,
    checkpoint_ids: list[int],
    recipe_ids: list[int],
    overrides: dict[str, Any],
    submitted_by: str | None,
) -> RunSubmission | None:
    """Returns None if a checkpoint_id or recipe_id doesn't exist, so the
    router 404s. Raises SubmitValidationError for a pair that cannot run
    as requested.
    """
    checkpoints_and_profiles = await load_checkpoints_and_profiles(db, checkpoint_ids)
    if checkpoints_and_profiles is None:
        return None

    base_recipes = await load_base_recipes(db, recipe_ids)
    if base_recipes is None:
        return None

    # Validate the whole grid before resolving anything -- see module
    # docstring on why a rejected submit must never mint a recipe row.
    for base_recipe in base_recipes:
        merged_config = base_recipe.as_hashable_dict() | overrides
        for checkpoint, serving_profile in checkpoints_and_profiles:
            report = validate_compatibility(checkpoint, serving_profile, merged_config)
            if report.status == "invalid":
                raise SubmitValidationError("; ".join(finding.message for finding in report.errors))

    resolved_recipe_id_by_base_id: dict[int, int] = {}
    for base_recipe in base_recipes:
        resolved_recipe = await resolve_recipe(db, base_recipe, overrides)
        resolved_recipe_id_by_base_id[base_recipe.id] = resolved_recipe.id

    run_group = await runs_queries.create_run_group(db, name, submitted_by)

    checkpoint_and_recipe_ids: list[tuple[int, int]] = []
    for checkpoint, _serving_profile in checkpoints_and_profiles:
        for base_recipe in base_recipes:
            resolved_recipe_id = resolved_recipe_id_by_base_id[base_recipe.id]
            checkpoint_and_recipe_ids.append((checkpoint.id, resolved_recipe_id))

    run_ids = await runs_queries.insert_eval_runs(
        db, run_group.id, checkpoint_and_recipe_ids, submitted_by
    )
    return RunSubmission(run_group_id=run_group.id, run_ids=run_ids)
