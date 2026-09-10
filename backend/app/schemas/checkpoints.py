"""Response shapes for GET /api/v1/checkpoints and /checkpoints/{id}, plus
(Phase 5) the request shapes for POST /checkpoints.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, model_validator

from app.schemas.serving_profiles import ServingProfileConfig


class CheckpointListItem(BaseModel):
    id: int
    name: str
    family: str | None
    path: str
    parent_checkpoint_id: int | None
    # Joined in from serving_profile -- the frontend displays label,
    # falling back to hash for an ad-hoc profile with no label (R-D16),
    # and has no reason to look up the profile separately for that.
    serving_profile_label: str | None
    serving_profile_hash: str
    # Joined in from sampling_profile, same reasoning -- named with the
    # default_ prefix (unlike serving_profile_label/_hash above) because
    # docs/STANDARDS_AND_PROFILES_PHASES.md Phase 2 names it explicitly;
    # the asymmetry with the two fields above stays rather than
    # triggering a rename outside this phase's scope.
    default_sampling_profile_label: str | None
    default_sampling_profile_hash: str
    created_at: datetime
    # Independent of registration (R-D1): a row stays even if the
    # weights behind it later vanish. 'unknown' for a checkpoint nobody
    # has validated yet -- the seeded row, until Phase 5's validate
    # route runs.
    availability_status: Literal["unknown", "available", "unavailable", "incomplete"]
    availability_checked_at: datetime | None
    # Lifted onto the list item, not just the detail response, so an
    # unavailable row can show why on the checkpoints page without a
    # second request per row (Phase 8).
    availability_detail: str | None


class CheckpointRunSummary(BaseModel):
    id: int
    standard_id: int
    status: str
    created_at: datetime
    finished_at: datetime | None


class CheckpointInferredMetadata(BaseModel):
    """What inspection read off the cluster at registration. Grouped
    behind one nested model rather than flattened onto CheckpointDetail
    so the detail response doesn't become a flat list of optional
    fields. Every field is nullable with no default (R-D20): NULL means
    "we could not read this," a real and common state for an older or
    unusual checkpoint. The seeded row predates inspection and holds
    NULL for all of them until Phase 5's validate route fills them in.
    """

    model_type: str | None
    architecture: str | None
    # Best-effort only -- a hint for the user, never a lineage FK
    # (R-D5). parent_checkpoint_id is the lineage FK.
    base_model: str | None
    context_length: int | None
    torch_dtype: str | None
    quantization: str | None
    weight_format: str | None
    shard_count: int | None
    size_bytes: int | None
    # Stored verbatim (R-D21): genuinely variable shape across model
    # families, which lets a later phase backfill a new inferred column
    # without re-reading the cluster.
    source_config: dict[str, Any] | None


class CheckpointDetail(CheckpointListItem):
    generation_config: dict[str, Any] | None
    registered_by: str | None
    inferred: CheckpointInferredMetadata
    runs: list[CheckpointRunSummary]  # empty this phase -- no eval_run rows exist yet


class ServingProfileSelection(BaseModel):
    """Exactly one of these: an existing profile to reuse as-is, or a
    customisation for the server to resolve (hash it, reuse an existing
    row on a match, otherwise mint a new one -- R-D22's registration
    counterpart of `resolve_serving_profile`).
    """

    existing_profile_id: int | None = None
    customised: ServingProfileConfig | None = None

    @model_validator(mode="after")
    def _exactly_one_selected(self) -> "ServingProfileSelection":
        if (self.existing_profile_id is None) == (self.customised is None):
            raise ValueError("exactly one of existing_profile_id or customised must be set")
        return self


class RegisterCheckpointRequest(BaseModel):
    """POST /checkpoints' body. Deliberately excludes `model_type`,
    `architecture`, `context_length`, and every other inferred field --
    the server re-reads a fresh inspection itself (R-D4), so a
    client-supplied value could never silently corrupt what compatibility
    checks downstream rely on.
    """

    reference: str
    name: str
    family: str | None = None
    # User-selected only, never inferred (R-D5) -- see
    # CheckpointInferredMetadata.base_model for the inferred hint.
    parent_checkpoint_id: int | None = None
    serving_profile: ServingProfileSelection
    # Optional, unlike serving_profile (S-D9): omitted means "the
    # checkpoint's recommended default," computed server-side by
    # registration.py. There is no ServingProfileSelection-style
    # customisation branch here yet -- Phase 2 ships with no sampling
    # picker in the UI at all (Phase 8 adds one as a pure enhancement).
    sampling_profile_id: int | None = None
    registered_by: str | None = None
