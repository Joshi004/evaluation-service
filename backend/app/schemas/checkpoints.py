"""Response shapes for GET /api/v1/checkpoints and /checkpoints/{id}."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class CheckpointListItem(BaseModel):
    id: int
    name: str
    family: str | None
    path: str
    parent_checkpoint_id: int | None
    # Joined in from serving_profile -- the frontend groups/labels by
    # this name and has no reason to look up the profile separately.
    serving_profile_name: str
    created_at: datetime


class CheckpointRunSummary(BaseModel):
    id: int
    recipe_id: int
    status: str
    created_at: datetime
    finished_at: datetime | None


class CheckpointDetail(CheckpointListItem):
    generation_config: dict[str, Any] | None
    registered_by: str | None
    runs: list[CheckpointRunSummary]  # empty this phase -- no eval_run rows exist yet
