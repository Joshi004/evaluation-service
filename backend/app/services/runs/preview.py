"""Read-only dry run for POST /runs (docs/IMPLEMENTATION_PHASES.md Phase
6). Mirrors submit.py's own grid resolution -- same checkpoint/recipe
loading, same two blocking checks -- but never calls `resolve_recipe`
(which inserts a recipe row) and never creates a run_group or eval_run
rows. It exists at all because the two blocking checks and decision D4's
warning all need `ServingProfile` fields (`max_model_len`, `vllm_flags`)
the browser can't see; duplicating those rules in TypeScript would let
the Submit page and the Standards page disagree about what a value
does.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint, Recipe, ServingProfile
from app.schemas.runs import RecipeFieldChange, ResolvedRecipePreview, RunPreview, RunPreviewPair
from app.services.recipes import queries as recipes_queries
from app.services.recipes.hashing import recipe_hash
from app.services.runs.submit import (
    context_window_conflict,
    load_base_recipes,
    load_checkpoints_and_profiles,
    think_handling_conflict,
)
from app.services.standards.capabilities import sampling_field_warnings


async def preview_runs(
    db: AsyncSession,
    checkpoint_ids: list[int],
    recipe_ids: list[int],
    overrides: dict[str, Any],
) -> RunPreview | None:
    """None if a checkpoint_id or recipe_id doesn't exist, so the router
    404s -- the same contract as submit_runs. Reports a blocking_error
    per pair instead of raising on the first one: a 3x6 grid with one
    bad pair should still show the other 17.
    """
    checkpoints_and_profiles = await load_checkpoints_and_profiles(db, checkpoint_ids)
    if checkpoints_and_profiles is None:
        return None

    base_recipes = await load_base_recipes(db, recipe_ids)
    if base_recipes is None:
        return None

    pairs: list[RunPreviewPair] = []
    resolved_recipes: list[ResolvedRecipePreview] = []
    for base_recipe in base_recipes:
        merged_config = base_recipe.as_hashable_dict() | overrides
        for checkpoint, serving_profile in checkpoints_and_profiles:
            pairs.append(_preview_pair(checkpoint, base_recipe, merged_config, serving_profile))
        resolved_recipes.append(await _preview_resolved_recipe(db, base_recipe, merged_config))

    # T1: GPUs are counted per distinct checkpoint, not per run -- a
    # submit of one checkpoint against six benchmarks shares one server.
    # Two checkpoints on the same serving_profile still count twice,
    # since each one gets its own endpoint.
    distinct_profiles_by_checkpoint = {
        checkpoint.id: serving_profile for checkpoint, serving_profile in checkpoints_and_profiles
    }
    gpu_count = sum(profile.gpus for profile in distinct_profiles_by_checkpoint.values())

    return RunPreview(
        run_count=len(pairs),
        gpu_count=gpu_count,
        pairs=pairs,
        resolved_recipes=resolved_recipes,
    )


def _preview_pair(
    checkpoint: Checkpoint,
    base_recipe: Recipe,
    merged_config: dict[str, Any],
    serving_profile: ServingProfile,
) -> RunPreviewPair:
    conflicts = [
        reason
        for reason in (
            context_window_conflict(merged_config, serving_profile),
            think_handling_conflict(merged_config, serving_profile),
        )
        if reason is not None
    ]
    return RunPreviewPair(
        checkpoint_id=checkpoint.id,
        checkpoint_name=checkpoint.name,
        recipe_id=base_recipe.id,
        recipe_label=base_recipe.label,
        benchmark=merged_config["benchmark"],
        blocking_error="; ".join(conflicts) if conflicts else None,
    )


async def _preview_resolved_recipe(
    db: AsyncSession, base_recipe: Recipe, merged_config: dict[str, Any]
) -> ResolvedRecipePreview:
    """What resolve_recipe (app.services.standards.resolve) would do for
    this base recipe plus these overrides, computed without its
    insert-on-miss side effect: the same hash function and the same
    by-hash lookup it uses internally, stopping short of the insert.
    """
    hash_value = recipe_hash(merged_config)
    existing = await recipes_queries.get_recipe_by_hash(db, hash_value)

    base_config = base_recipe.as_hashable_dict()
    changed_fields = [
        RecipeFieldChange(
            field=field, base_value=base_config[field], override_value=merged_config[field]
        )
        for field in base_config
        if base_config[field] != merged_config[field]
    ]

    return ResolvedRecipePreview(
        base_recipe_id=base_recipe.id,
        hash=hash_value,
        is_new_recipe=existing is None,
        changed_fields=changed_fields,
        warnings=sampling_field_warnings(merged_config["framework"], merged_config),
    )
