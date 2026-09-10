"""Per-framework sampling fields a sampling profile may set but that
framework will silently drop -- decision D4
(docs/IMPLEMENTATION_PHASES.md Section 0.8).

`min_p` is the only v1 entry: EvalScope's `GenerateConfig` has no `min_p`
field, and its `openai_api` request builder never reads `model_extra`, so
a non-zero `min_p` recorded against the `evalscope` framework never
reaches vLLM. Rather than reject that value at load time, a sampling
profile is allowed to record it -- someone's recommended settings, say --
and the mismatch surfaces as a warning wherever the profile is shown to
a human (the Standards page, and the Submit dry-run preview).
"""

from typing import Any

from app.schemas.standards import SamplingFieldWarning

FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS: dict[str, set[str]] = {
    "evalscope": {"min_p"},
}


def sampling_field_warnings(
    framework: str, sampling_config: dict[str, Any]
) -> list[SamplingFieldWarning]:
    """Every D4 warning that applies to `sampling_config` under
    `framework`.

    `framework` and `sampling_config` arrive as two arguments, not one
    merged dict, because they now come from two different rows (the
    standard and the resolved sampling profile, Phase 3's split).
    `sampling_config` may be a complete `SamplingProfile.as_hashable_dict()`
    (a run's resolved profile, or the Submit preview's not-yet-resolved
    merge) or a sparse `standard.sampling_overrides` (the Standards
    page, which has no checkpoint and so no full profile to show) --
    `.get(field, 0.0)` treats "not mentioned" the same as "the field's
    own default", so a sparse dict never raises `KeyError` and never
    warns about a field it simply doesn't set.
    """
    warnings = []
    unsupported_fields = FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS.get(framework, set())
    if "min_p" in unsupported_fields and sampling_config.get("min_p", 0.0) != 0.0:
        warnings.append(
            SamplingFieldWarning(
                field="min_p",
                message="not forwarded by evalscope's openai_api path — recorded, has no effect",
            )
        )
    return warnings
