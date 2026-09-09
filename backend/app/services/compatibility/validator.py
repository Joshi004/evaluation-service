"""The single place that answers "can this checkpoint, this serving
profile, and this recipe actually run together" -- one function,
assembling every rule in `rules.py` into one report. See
docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 6.
"""

from typing import Any

from app.models import Checkpoint, ServingProfile
from app.schemas.compatibility import CompatibilityFinding, CompatibilityReport
from app.services.compatibility import rules


def validate_compatibility(
    checkpoint: Checkpoint,
    serving_profile: ServingProfile,
    recipe_config: dict[str, Any],
) -> CompatibilityReport:
    """Three already-loaded rows in, a report out (R-D29) -- no
    session and no SSH, so this is callable from submit, from preview,
    and from anywhere later with nothing to fake to call it.

    `recipe_config` is a merged config dict (`Recipe.as_hashable_dict()
    | overrides`) rather than a `Recipe` row, for the reason
    `sampling_field_warnings` already documents: the preview must
    evaluate a not-yet-resolved override without inserting a recipe row
    to do it.
    """
    errors: list[CompatibilityFinding] = [
        finding
        for finding in (
            rules.max_tokens_exceeds_context(recipe_config, serving_profile),
            rules.as_is_needs_no_reasoning_parser(recipe_config, serving_profile),
            rules.strip_needs_reasoning_parser(recipe_config, serving_profile),
            rules.profile_exceeds_model_context(checkpoint, serving_profile),
            rules.parallelism_gpu_mismatch(serving_profile),
            rules.checkpoint_unavailable(checkpoint),
        )
        if finding is not None
    ]

    warnings: list[CompatibilityFinding] = [
        finding
        for finding in (
            rules.checkpoint_availability_stale(checkpoint),
            rules.recipe_max_tokens_below_checkpoint_default(checkpoint, recipe_config),
            rules.quantization_mismatch(checkpoint, serving_profile),
        )
        if finding is not None
    ]
    warnings.extend(rules.framework_drops_sampling_field(recipe_config))

    return CompatibilityReport(errors=errors, warnings=warnings)
