"""Per-framework sampling fields a recipe may set but that framework will
silently drop -- decision D4 (docs/IMPLEMENTATION_PHASES.md Section 0.8).

`min_p` is the only v1 entry: EvalScope's `GenerateConfig` has no `min_p`
field, and its `openai_api` request builder never reads `model_extra`, so
a non-zero `min_p` recorded against the `evalscope` framework never
reaches vLLM. Rather than reject that value at load time, a recipe is
allowed to record it -- someone's recommended settings, say -- and the
mismatch surfaces as a warning wherever the recipe is shown to a human
(the Standards page, and Phase 6's Submit dry-run preview).
"""

from typing import Any

from app.schemas.recipes import RecipeFieldWarning

FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS: dict[str, set[str]] = {
    "evalscope": {"min_p"},
}


def sampling_field_warnings(framework: str, config: dict[str, Any]) -> list[RecipeFieldWarning]:
    """Every D4 warning that applies to `config` under `framework`.

    Takes a plain merged-config dict rather than a `Recipe` row so this
    is equally usable for a stored recipe (the Standards page) and a
    not-yet-resolved override (Phase 6's Submit preview, which must not
    insert a recipe row just to compute a warning) -- both shapes come
    from the same `Recipe.as_hashable_dict()` key set.
    """
    warnings = []
    unsupported_fields = FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS.get(framework, set())
    if "min_p" in unsupported_fields and config["min_p"] != 0.0:
        warnings.append(
            RecipeFieldWarning(
                field="min_p",
                message="not forwarded by evalscope's openai_api path — recorded, has no effect",
            )
        )
    return warnings
