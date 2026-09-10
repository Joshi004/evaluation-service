"""One function per compatibility rule, each returning a
`CompatibilityFinding | None` (or, for the one rule that can fire more
than once per pair, a `list[CompatibilityFinding]`). Assembled by
`app.services.compatibility.validator.validate_compatibility`.

One function per rule is what keeps the set readable and lets each rule
carry its own reason in its own docstring, rather than a single
sprawling function trying to explain all of them at once. See
docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 6 for the full list and its
Section 10 item 3 for the two rules whose exact shape needed a decision
beyond what the phase doc itself settled, and
docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3 for why several of them
now take a `standard_config` and a `sampling_config` instead of one
merged dict.
"""

from typing import Any

from app.models import Checkpoint, ServingProfile
from app.schemas.compatibility import CompatibilityFinding
from app.services.serving_profiles.render import serving_profile_display_name
from app.services.standards.capabilities import sampling_field_warnings

# The endpoint's max_model_len is the model's whole context window --
# prompt plus completion together -- while sampling.max_tokens bounds
# only the generated completion. IFEval prompts run to a few hundred
# tokens; 2048 is deliberately generous headroom rather than a measured
# worst case, so a sampling profile that is genuinely too big for a
# serving profile fails at submit time instead of after a cold start.
_PROMPT_ALLOWANCE_TOKENS = 2048


def max_tokens_exceeds_context(
    sampling_config: dict[str, Any], serving_profile: ServingProfile
) -> CompatibilityFinding | None:
    """None if `sampling_config` fits `serving_profile`'s context window,
    otherwise the exact reason it doesn't. Moved from
    `runs/submit.py::context_window_conflict` with its message text
    unchanged (R-T20) -- the preview a user read must match the error
    they get from a real submit.
    """
    if serving_profile.max_model_len is None:
        return None
    max_tokens = sampling_config["max_tokens"]
    if max_tokens + _PROMPT_ALLOWANCE_TOKENS > serving_profile.max_model_len:
        return CompatibilityFinding(
            code="max_tokens_exceeds_context",
            field="sampling.max_tokens",
            message=(
                f"sampling max_tokens ({max_tokens}) plus a {_PROMPT_ALLOWANCE_TOKENS}-token "
                f"prompt allowance exceeds serving profile "
                f"{serving_profile_display_name(serving_profile)!r}'s max_model_len "
                f"({serving_profile.max_model_len})"
            ),
        )
    return None


def as_is_needs_no_reasoning_parser(
    standard_config: dict[str, Any], serving_profile: ServingProfile
) -> CompatibilityFinding | None:
    """None if `standard_config`'s think_handling is compatible with
    `serving_profile`, otherwise the exact reason it isn't. Moved from
    `runs/submit.py::think_handling_conflict` with its message text
    unchanged (R-T20).

    Phase 2 Trap T5: think_handling='strip' is only mechanically true
    when the endpoint's profile carries --reasoning-parser -- vLLM has to
    split <think>...</think> into reasoning_content before EvalScope ever
    sees content. An 'as_is' standard needs the opposite: no reasoning
    parser, or the think text never reaches content for EvalScope to
    score in the first place. A standard requesting 'as_is' against a
    profile with a reasoning parser is a request that cannot do what it
    says.
    """
    has_reasoning_parser = serving_profile.reasoning_parser is not None
    if standard_config["think_handling"] == "as_is" and has_reasoning_parser:
        return CompatibilityFinding(
            code="as_is_needs_no_reasoning_parser",
            field="standard.think_handling",
            message=(
                f"standard think_handling='as_is' cannot run against serving profile "
                f"{serving_profile_display_name(serving_profile)!r}, which carries "
                "--reasoning-parser: the think block would never reach the completion "
                "this standard means to score whole"
            ),
        )
    return None


def strip_needs_reasoning_parser(
    standard_config: dict[str, Any],
    sampling_config: dict[str, Any],
    serving_profile: ServingProfile,
) -> CompatibilityFinding | None:
    """Error, but only when there is an actual think block to strip.
    `think_handling='strip'` with `enable_thinking=False` is inert
    regardless of serving profile -- there is no think block for a
    no-parser profile to fail to split out. Gating on `enable_thinking`
    is what keeps a standard like `ifeval/v1` paired with the `greedy`
    sampling profile from tripping this rule (Section 10 item 3's
    resolution), even though the same standard paired with
    `qwen3_think` needs the reasoning parser this rule checks for. When
    `enable_thinking` is true, though, the strip is mechanically broken
    without a reasoning parser -- there is no way to make it correct
    after the fact, which is why this is an error and not a warning.
    """
    if (
        standard_config["think_handling"] == "strip"
        and sampling_config["enable_thinking"] is True
        and serving_profile.reasoning_parser is None
    ):
        return CompatibilityFinding(
            code="strip_needs_reasoning_parser",
            field="standard.think_handling",
            message=(
                f"standard think_handling='strip' with enable_thinking=true needs a "
                f"--reasoning-parser to split the <think> block out, but serving profile "
                f"{serving_profile_display_name(serving_profile)!r} carries none -- the "
                "think block would remain in the completion this standard means to score"
            ),
        )
    return None


def profile_exceeds_model_context(
    checkpoint: Checkpoint, serving_profile: ServingProfile
) -> CompatibilityFinding | None:
    """vLLM refuses to start when `--max-model-len` exceeds the
    checkpoint's own trained context length -- today that surfaces six
    minutes later as an opaque crash on the login node rather than up
    front. Skips cleanly when `context_length` is null (R-T21): the
    seeded checkpoint has none until someone validates it, and null must
    never be treated as zero.
    """
    if checkpoint.context_length is None or serving_profile.max_model_len is None:
        return None
    if serving_profile.max_model_len > checkpoint.context_length:
        return CompatibilityFinding(
            code="profile_exceeds_model_context",
            field="serving_profile.max_model_len",
            message=(
                f"serving profile {serving_profile_display_name(serving_profile)!r}'s "
                f"max_model_len ({serving_profile.max_model_len}) exceeds checkpoint "
                f"{checkpoint.name!r}'s own context_length ({checkpoint.context_length}) -- "
                "vLLM will refuse to start"
            ),
        )
    return None


def parallelism_gpu_mismatch(serving_profile: ServingProfile) -> CompatibilityFinding | None:
    """R-D18: `gpus` stays a real column alongside the parallel sizes --
    it goes in the sbatch `--gres` line, and it is not always their
    product in principle -- so the schema doesn't force the two to
    agree. This rule flags it when they disagree instead.
    """
    expected_gpus = serving_profile.tensor_parallel_size * serving_profile.pipeline_parallel_size
    if serving_profile.gpus != expected_gpus:
        return CompatibilityFinding(
            code="parallelism_gpu_mismatch",
            field="serving_profile.gpus",
            message=(
                f"serving profile {serving_profile_display_name(serving_profile)!r} requests "
                f"{serving_profile.gpus} GPU(s) but tensor_parallel_size "
                f"({serving_profile.tensor_parallel_size}) x pipeline_parallel_size "
                f"({serving_profile.pipeline_parallel_size}) = {expected_gpus}"
            ),
        )
    return None


def checkpoint_unavailable(checkpoint: Checkpoint) -> CompatibilityFinding | None:
    """The rule the pre-launch availability check (worker.py::_run_one)
    exists to make actionable: a checkpoint whose weights are confirmed
    gone must not reach a serve job, at submit time or at launch time
    (R-D26).
    """
    if checkpoint.availability_status == "unavailable":
        detail_suffix = (
            f": {checkpoint.availability_detail}" if checkpoint.availability_detail else ""
        )
        return CompatibilityFinding(
            code="checkpoint_unavailable",
            field="checkpoint.availability_status",
            message=f"checkpoint {checkpoint.name!r} is marked unavailable{detail_suffix}",
        )
    return None


def checkpoint_availability_stale(checkpoint: Checkpoint) -> CompatibilityFinding | None:
    """`unknown` and `incomplete` -- plus a null `availability_checked_at`
    under any status -- all mean "we don't actually know this is fine
    right now," which is worth surfacing without blocking a submit.
    `unknown` is a legitimate state for a checkpoint nobody has checked
    yet (R-T28 applies at render time, not here), not a failure.
    """
    if (
        checkpoint.availability_status in ("unknown", "incomplete")
        or checkpoint.availability_checked_at is None
    ):
        return CompatibilityFinding(
            code="checkpoint_availability_stale",
            field="checkpoint.availability_status",
            message=(
                f"checkpoint {checkpoint.name!r}'s availability is "
                f"{checkpoint.availability_status!r} and has not been freshly confirmed -- "
                "re-validate before relying on it"
            ),
        )
    return None


def standard_max_tokens_below_checkpoint_default(
    checkpoint: Checkpoint, sampling_config: dict[str, Any]
) -> CompatibilityFinding | None:
    """`DATA_MODEL_V1.md` Section 3.2's own rationale for storing
    `generation_config` at all: "this checkpoint wants max_tokens 32768
    and your sampling profile says 8192" is the truncation failure that
    column exists to catch. This checks the inverse of the phase doc's
    originally proposed direction -- renamed once already to match the
    direction it actually checks (see
    docs/CHECKPOINT_REGISTRATION_PHASES.md Section 10 item 3), and again
    here for the standard/sampling split, even though the value it reads
    now lives on the resolved sampling profile rather than the standard.
    Skips cleanly when `generation_config` is null or carries no
    `max_tokens` key (R-T21): it is stored verbatim, and not every
    checkpoint's own file uses that exact key.
    """
    generation_config = checkpoint.generation_config
    if generation_config is None:
        return None
    checkpoint_max_tokens = generation_config.get("max_tokens")
    if checkpoint_max_tokens is None:
        return None
    sampling_max_tokens = sampling_config["max_tokens"]
    if sampling_max_tokens < checkpoint_max_tokens:
        return CompatibilityFinding(
            code="standard_max_tokens_below_checkpoint_default",
            field="sampling.max_tokens",
            message=(
                f"checkpoint {checkpoint.name!r} wants max_tokens {checkpoint_max_tokens} "
                f"but this sampling profile sets {sampling_max_tokens} -- responses may be "
                "truncated before they reach the checkpoint's own expected length"
            ),
        )
    return None


def quantization_mismatch(
    checkpoint: Checkpoint, serving_profile: ServingProfile
) -> CompatibilityFinding | None:
    """Both are nullable and independently set -- a checkpoint's
    quantization is inferred at registration, a profile's is chosen when
    the profile is created -- so nothing else enforces they agree.
    Warns rather than errors: vLLM does not refuse to start over this,
    but a mismatch this basic is worth flagging up front. Skips cleanly
    when either side is null (R-T21): null means "not quantized" for a
    profile but "not read" for a checkpoint, and neither alone is a
    mismatch worth reporting.
    """
    if checkpoint.quantization is None or serving_profile.quantization is None:
        return None
    if checkpoint.quantization != serving_profile.quantization:
        return CompatibilityFinding(
            code="quantization_mismatch",
            field="serving_profile.quantization",
            message=(
                f"checkpoint {checkpoint.name!r}'s own quantization "
                f"({checkpoint.quantization!r}) does not match serving profile "
                f"{serving_profile_display_name(serving_profile)!r}'s quantization "
                f"({serving_profile.quantization!r})"
            ),
        )
    return None


def framework_drops_sampling_field(
    standard_config: dict[str, Any], sampling_config: dict[str, Any]
) -> list[CompatibilityFinding]:
    """The one rule that returns a list rather than a single finding,
    because a sampling profile can set more than one framework-
    unsupported field at once. Wraps `sampling_field_warnings()`
    (app.services.standards.capabilities) rather than reimplementing it
    -- that's the same function the Standards page and `RunSamplingDetail`
    (app/schemas/runs.py) use to warn about the same fields, so a
    submit's own warning can never disagree with either.
    """
    return [
        CompatibilityFinding(
            code="framework_drops_sampling_field",
            field=f"sampling.{warning.field}",
            message=warning.message,
        )
        for warning in sampling_field_warnings(standard_config["framework"], sampling_config)
    ]
