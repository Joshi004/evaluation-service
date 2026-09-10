"""Wire shapes for `sampling_profile` (docs/STANDARDS_AND_PROFILES_PHASES.md
Section 0.5, Phase 2).

`SamplingProfileConfig` is the nine-field hashable config -- the same
key set `SamplingProfile.as_hashable_dict()` produces -- for a caller
that builds a profile's content rather than reading an already-persisted
row. `SamplingProfileDocument` is the same nine fields plus `label`, for
validating a `catalog/sampling-profiles/*.yaml` file -- composed from
`SamplingProfileConfig` rather than restating its fields, mirroring
`ServingProfileDocument`'s relationship to `ServingProfileConfig`.
`SamplingProfileSummary` is the persisted-row shape a future picker
reads (Phase 7); no route serves individual customisation yet since
nothing resolves a sampling profile until Phase 3.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict

from app.schemas.catalog import CatalogDocument


class SamplingProfileConfig(BaseModel):
    """The nine fields that can change how a sampling profile asks a
    model to speak -- exactly `SamplingProfile.as_hashable_dict()`'s key
    set, with the defaults from Section 0.5. `extra="forbid"` so a
    typo'd field name fails loudly instead of being silently dropped
    from the hash.
    """

    model_config = ConfigDict(extra="forbid")

    temperature: float
    top_p: float
    top_k: int
    min_p: float = 0.0
    presence_penalty: float = 0.0
    repetition_penalty: float = 1.0
    max_tokens: int
    enable_thinking: bool
    # S-D6: hashed, not operational -- pinning it is what makes a
    # profile's promise honest (run this again, get the same answer).
    seed: int = 42


class SamplingProfileDocument(CatalogDocument, SamplingProfileConfig):
    """A `catalog/sampling-profiles/*.yaml` file. Composes `label`
    (`CatalogDocument`) with the nine hashable fields
    (`SamplingProfileConfig`) rather than restating either -- both
    already set `extra="forbid"`, so a YAML profile and a resolved
    customisation (Phase 3) can never validate under different rules.
    """

    def as_hashable_dict(self) -> dict[str, Any]:
        """Exactly `SamplingProfileConfig`'s key set -- verified by
        construction: this is `model_dump()` over every field except
        `label`, and `SamplingProfileConfig` contributes no field but
        those nine.
        """
        return self.model_dump(exclude={"label"})


class SamplingProfileSummary(BaseModel):
    """id/hash/label, plus every field from `SamplingProfileConfig` --
    complete, for the same reason `ServingProfileSummary`'s docstring
    gives: a "customise, change nothing" flow (Phase 3+) must reseed
    from real values, not defaults, and a field missing here would seed
    a draft from a default instead of the profile it started from.
    """

    id: int
    hash: str
    label: str | None
    temperature: float
    top_p: float
    top_k: int
    min_p: float
    presence_penalty: float
    repetition_penalty: float
    max_tokens: int
    enable_thinking: bool
    seed: int


class SamplingProfileRecommendation(BaseModel):
    """Registration's suggested sampling profile for a freshly-inspected
    checkpoint, attached to `CheckpointInspection` by the controller
    (`app.services.checkpoints.recommendation`). `reason` is never
    optional -- a recommendation the user cannot see the basis for is
    one they will ignore.
    """

    profile: SamplingProfileSummary | None
    reason: str
