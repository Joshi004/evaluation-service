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

from app.models import Checkpoint, ServingProfile
from app.schemas.runs import RunSubmission
from app.services.endpoints import queries as endpoints_queries
from app.services.recipes import queries as recipes_queries
from app.services.runs import queries as runs_queries
from app.services.standards.resolve import resolve_recipe

# The endpoint's max_model_len is the model's whole context window --
# prompt plus completion together -- while recipe.max_tokens bounds only
# the generated completion. IFEval prompts run to a few hundred tokens;
# 2048 is deliberately generous headroom rather than a measured worst
# case, so a recipe that is genuinely too big for a profile fails at
# submit time instead of after a cold start.
_PROMPT_ALLOWANCE_TOKENS = 2048


class SubmitValidationError(Exception):
    """A submit that would fail predictably -- minutes into a cold start
    -- rather than at request time. The router maps this to a 400.
    """


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
    checkpoints_and_profiles: list[tuple[Checkpoint, ServingProfile]] = []
    for checkpoint_id in checkpoint_ids:
        checkpoint_and_profile = await endpoints_queries.get_checkpoint_and_serving_profile(
            db, checkpoint_id
        )
        if checkpoint_and_profile is None:
            return None
        checkpoints_and_profiles.append(checkpoint_and_profile)

    base_recipes = []
    for recipe_id in recipe_ids:
        base_recipe = await recipes_queries.get_recipe(db, recipe_id)
        if base_recipe is None:
            return None
        base_recipes.append(base_recipe)

    # Validate the whole grid before resolving anything -- see module
    # docstring on why a rejected submit must never mint a recipe row.
    for base_recipe in base_recipes:
        merged_config = base_recipe.as_hashable_dict() | overrides
        for _checkpoint, serving_profile in checkpoints_and_profiles:
            _check_fits_context_window(merged_config, serving_profile)
            _check_think_handling_compatible(merged_config, serving_profile)

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


def _check_fits_context_window(
    recipe_config: dict[str, Any], serving_profile: ServingProfile
) -> None:
    if serving_profile.max_model_len is None:
        return
    max_tokens = recipe_config["max_tokens"]
    if max_tokens + _PROMPT_ALLOWANCE_TOKENS > serving_profile.max_model_len:
        raise SubmitValidationError(
            f"recipe max_tokens ({max_tokens}) plus a {_PROMPT_ALLOWANCE_TOKENS}-token "
            f"prompt allowance exceeds serving profile {serving_profile.name!r}'s "
            f"max_model_len ({serving_profile.max_model_len})"
        )


def _check_think_handling_compatible(
    recipe_config: dict[str, Any], serving_profile: ServingProfile
) -> None:
    """Phase 2 Trap T5: think_handling='strip' is only mechanically true
    when the endpoint's profile carries --reasoning-parser -- vLLM has to
    split <think>...</think> into reasoning_content before EvalScope ever
    sees content. An 'as_is' recipe needs the opposite: no reasoning
    parser, or the think text never reaches content for EvalScope to
    score in the first place. A recipe requesting 'as_is' against a
    profile with a reasoning parser is a request that cannot do what it
    says.
    """
    has_reasoning_parser = "--reasoning-parser" in serving_profile.vllm_flags
    if recipe_config["think_handling"] == "as_is" and has_reasoning_parser:
        raise SubmitValidationError(
            f"recipe think_handling='as_is' cannot run against serving profile "
            f"{serving_profile.name!r}, which carries --reasoning-parser: the think "
            "block would never reach the completion this recipe means to score whole"
        )
