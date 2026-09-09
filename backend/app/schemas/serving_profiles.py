"""Wire shapes for `serving_profile` (docs/CHECKPOINT_REGISTRATION_PHASES.md
Section 0.5, Phase 3).

`ServingProfileConfig` is the eleven-field hashable config -- the same
key set `ServingProfile.as_hashable_dict()` produces -- for a caller that
builds a profile's content rather than reading an already-persisted row:
`resolve_serving_profile`'s input today, and (from Phase 5) the
customisation branch of registration. `ServingProfileSummary` is the
persisted-row shape the profile picker reads; no route serves it until
Phase 5's GET /serving-profiles.
"""

from pydantic import BaseModel, ConfigDict, field_validator

# Every key here either duplicates a structured column above or (
# "generation-config") is unconditional and never overridable (R-D7).
# Rejecting them at the schema boundary, rather than merely ignoring them
# at render time, is what keeps a customisation's hash reflecting every
# field that can change how it serves -- an accepted-but-ignored key
# would let two profiles that render identically hash differently.
_RESERVED_ENGINE_OPTION_KEYS = frozenset(
    {
        "generation-config",
        "tensor-parallel-size",
        "pipeline-parallel-size",
        "max-model-len",
        "reasoning-parser",
        "dtype",
        "quantization",
        "gpu-memory-utilization",
    }
)

# R-D6's exact value shape: `true` renders as a bare flag, `false` omits
# it entirely, anything else renders as `--key value`.
_EngineOptionValue = str | int | float | bool


class ServingProfileConfig(BaseModel):
    """The eleven fields that can change what a serving profile does --
    exactly `ServingProfile.as_hashable_dict()`'s key set, with the
    defaults from Section 0.5. `extra="forbid"` so a typo'd field name
    fails loudly instead of being silently dropped from the hash.
    """

    model_config = ConfigDict(extra="forbid")

    engine: str
    engine_version: str
    gpus: int = 1
    tensor_parallel_size: int = 1
    pipeline_parallel_size: int = 1
    max_model_len: int | None = None
    reasoning_parser: str | None = None
    dtype: str = "auto"
    quantization: str | None = None
    gpu_memory_utilization: float = 0.90
    # Escape hatch for uncommon or newly added engine settings (R-D6) --
    # not a second home for anything that already has a column above.
    engine_options: dict[str, _EngineOptionValue] = {}

    @field_validator("engine_options")
    @classmethod
    def _validate_engine_options(
        cls, value: dict[str, _EngineOptionValue]
    ) -> dict[str, _EngineOptionValue]:
        for key, option_value in value.items():
            if key in _RESERVED_ENGINE_OPTION_KEYS:
                raise ValueError(
                    f"engine_options key {key!r} duplicates a structured field, or is "
                    "generation-config (always emitted, R-D7) -- set it through that "
                    "field instead"
                )
            # Pydantic's own dict[str, _EngineOptionValue] typing already
            # rejects a nested dict/list value; this check exists so the
            # error names the offending key rather than dumping every
            # union member Pydantic tried.
            if not isinstance(option_value, str | int | float | bool):
                raise ValueError(f"engine_options[{key!r}] must be str, int, float, or bool")
        return value


class ServingProfileSummary(BaseModel):
    """What the profile picker shows: id/hash/label, plus every field
    from `ServingProfileConfig` (all eleven -- the six shown at a glance
    plus the five below). The wizard's "customise" form seeds its draft
    from whichever profile is currently selected (recommended or picked),
    so the summary must carry a *complete* config -- a field missing here
    would seed the draft from a default instead of the real value, and
    "customise, change nothing" would then mint a new profile instead of
    reusing the one it started from.
    """

    id: int
    hash: str
    label: str | None
    engine: str
    engine_version: str
    gpus: int
    tensor_parallel_size: int
    pipeline_parallel_size: int
    max_model_len: int | None
    reasoning_parser: str | None
    dtype: str
    quantization: str | None
    gpu_memory_utilization: float
    engine_options: dict[str, _EngineOptionValue]


class ServingProfileRecommendation(BaseModel):
    """Registration's suggested serving profile for a freshly-inspected
    checkpoint, attached to `CheckpointInspection` by the controller
    (`app.services.checkpoints.recommendation`). `reason` is never
    optional -- a recommendation the user cannot see the basis for is
    one they will ignore.
    """

    profile: ServingProfileSummary | None
    reason: str
