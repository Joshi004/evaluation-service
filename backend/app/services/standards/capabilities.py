"""Per-framework sampling fields a sampling profile may set but that
framework will silently drop -- decision D4
(docs/IMPLEMENTATION_PHASES.md Section 0.8) -- plus one sampling field
whose delivery depends on a *standard* setting rather than the
framework: `seed` under `repeats > 1` (`per_request_seed_applies`
below).

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

# Shared verbatim by compatibility.rules.seed_not_applied_with_repeats
# (the submit-time warning) and runs.queries._to_run_sampling_detail
# (the same warning on a finished run's own page) -- one wording, so a
# preview and the run it produced can never describe this differently.
SEED_NOT_APPLIED_WITH_REPEATS_MESSAGE = (
    "seed is not sent to the model when repeats > 1 -- EvalScope sends every "
    "repeat of a sample as an identical request, so a fixed seed would turn "
    "them into repeats copies of one answer instead of independent draws. "
    "This run is not reproducible."
)


def per_request_seed_applies(repeats: int) -> bool:
    """Whether `task_config.py` may send `sampling_profile.seed` on the
    request itself (`generation_config.seed`, which EvalScope forwards
    into each request's OpenAI-compatible body verbatim -- confirmed
    against the pinned commit's `models/utils/openai.py` -- and vLLM
    then seeds that one request's own generator from, independent of
    whatever else the server is doing). Without this, `seed` only ever
    reaches EvalScope's own `seed_everything()` call, which affects the
    harness process's dataset ordering and never reaches the model at
    all -- confirmed against the pinned commit's `run.py`.

    `repeats == 1` is the only safe case: EvalScope sends every repeat
    of one sample as an identical request (`api/dataset/builder.py`'s
    own repeat duplication happens before generation, not after), so a
    fixed seed under `repeats > 1` would make every one of those
    repeats draw the exact same answer -- exactly the "independent
    draws" a repeat exists to give GPQA-Diamond's pooled mean.
    `rules.seed_not_applied_with_repeats` is the compatibility warning
    that fires whenever this is `False`.
    """
    return repeats == 1


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
