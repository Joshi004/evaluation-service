"""Renders a serving profile's structured fields into vLLM's engine
argv -- the single place a profile becomes a flag list
(docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 3, item 5). Everything
above this passes the result straight into `ServeJobSpec.engine_args`;
no other module builds a flag list out of a `ServingProfile` row.
"""

from app.models import ServingProfile

# R-D6's exact value shape: `true` renders as a bare flag, `false` omits
# it entirely, anything else renders as `--key value`.
_EngineOptionValue = str | int | float | bool


def render_engine_args(profile: ServingProfile) -> list[str]:
    """One argv token per element, so there is no shell quoting to get
    wrong -- `serve_job.render_serve_script` joins these with spaces
    onto one line.

    `--generation-config vllm` is emitted first and unconditionally
    (R-D7): without it, vLLM silently applies the checkpoint's own
    `generation_config.json` underneath whatever a recipe set.
    """
    args = [
        "--generation-config",
        "vllm",
        "--tensor-parallel-size",
        str(profile.tensor_parallel_size),
        "--pipeline-parallel-size",
        str(profile.pipeline_parallel_size),
        "--dtype",
        profile.dtype,
        "--gpu-memory-utilization",
        str(profile.gpu_memory_utilization),
    ]
    if profile.max_model_len is not None:
        args += ["--max-model-len", str(profile.max_model_len)]
    if profile.reasoning_parser is not None:
        args += ["--reasoning-parser", profile.reasoning_parser]
    if profile.quantization is not None:
        args += ["--quantization", profile.quantization]

    # Sorted by key so the rendered argv is deterministic (R-D6).
    for key in sorted(profile.engine_options):
        args += _render_engine_option(key, profile.engine_options[key])

    return args


def _render_engine_option(key: str, value: _EngineOptionValue) -> list[str]:
    if value is True:
        return [f"--{key}"]
    if value is False:
        return []
    return [f"--{key}", str(value)]


def serving_profile_display_name(profile: ServingProfile) -> str:
    """A profile's label-or-hash -- mirrors
    frontend/src/utils/recipeDisplayName.ts and, before it,
    `Recipe.label`'s own fallback rule. An ad-hoc customisation has
    `label=None`, so the hash is the only thing that identifies it in a
    message a human reads (e.g. `runs/submit.py`'s conflict messages).
    """
    return profile.label if profile.label is not None else profile.hash
