"""Response shapes for GET /api/v1/checkpoints and /checkpoints/{id}."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


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
    created_at: datetime
    # Independent of registration (R-D1): a row stays even if the
    # weights behind it later vanish. 'unknown' for a checkpoint nobody
    # has validated yet -- the seeded row, until Phase 5's validate
    # route runs.
    availability_status: Literal["unknown", "available", "unavailable", "incomplete"]
    availability_checked_at: datetime | None


class CheckpointRunSummary(BaseModel):
    id: int
    recipe_id: int
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
    availability_detail: str | None
    runs: list[CheckpointRunSummary]  # empty this phase -- no eval_run rows exist yet
