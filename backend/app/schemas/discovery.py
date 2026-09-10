"""Response shapes for the discovery API -- browsing, inspecting, and
validating checkpoint candidates on the cluster. See
docs/CHECKPOINT_REGISTRATION_PHASES.md Section 0.5 and Phase 2.

These are also the return types of the `ModelDiscovery` port
(app/services/cluster/ports.py), so a candidate directory is described
the same way whether it arrived through the API or was read straight
out of an implementation.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.schemas.sampling_profiles import SamplingProfileRecommendation
from app.schemas.serving_profiles import ServingProfileRecommendation


class CheckpointCandidate(BaseModel):
    """One directory on the cluster that looks evaluable -- not yet a
    database row. `already_registered` defaults to False because the
    port that produces this has no idea the database exists (R-D14);
    the controller is what sets the real value, by comparing `reference`
    against every registered `checkpoint.path` in one query.
    """

    reference: str
    display_name: str
    already_registered: bool = False
    modified_at: datetime | None


class CheckpointInspection(BaseModel):
    """Everything readable about one candidate. A partial inspection is
    still a success (R-D15): an unreadable optional file shows up as a
    line in `problems` with its field left `None`, not as a raised
    error. `readable` is False only when `config.json` itself -- the one
    file registration cannot proceed without -- could not be read.
    """

    reference: str
    display_name: str
    model_type: str | None
    architecture: str | None
    # Best-effort only -- a hint for the user, never a lineage FK (R-D5).
    base_model: str | None
    context_length: int | None
    torch_dtype: str | None
    quantization: str | None
    weight_format: str | None
    shard_count: int | None
    size_bytes: int | None
    generation_config: dict[str, Any] | None
    source_config: dict[str, Any] | None
    readable: bool
    problems: list[str]
    # Set by the controller, not the port (mirrors `already_registered`
    # on `CheckpointCandidate` above): recommending a profile needs the
    # database, and `ModelDiscovery` implementations never touch it
    # (R-D14). `None` until the controller attaches it.
    recommendation: ServingProfileRecommendation | None = None
    # Same reasoning, one profile over (docs/STANDARDS_AND_PROFILES_PHASES.md
    # Phase 2, item 6) -- attached alongside `recommendation` so the
    # registration wizard needs no second round trip once Phase 7 adds
    # a sampling-profile control.
    sampling_recommendation: SamplingProfileRecommendation | None = None


class CheckpointAvailability(BaseModel):
    """Whether the weights behind a candidate (registered or not) are
    still readable and complete. Kept separate from `CheckpointInspection`
    because availability is re-checked repeatedly against a registered
    row (R-D1), while an inspection is a one-time read at registration.
    """

    reference: str
    status: Literal["available", "unavailable", "incomplete"]
    detail: str | None
    size_bytes: int | None
    checked_at: datetime


class InspectCheckpointRequest(BaseModel):
    """POST body for /checkpoints/candidates/inspect (R-D13: a reference
    does not URL-encode cleanly as a path segment, and inspection does
    real remote work, so it is not a plain GET).
    """

    reference: str
