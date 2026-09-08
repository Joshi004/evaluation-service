"""Response shape for GET /api/v1/runs.

Returns [] this phase -- no eval_run rows are written until Phase 3
submits real jobs to the cluster.
"""

from datetime import datetime

from pydantic import BaseModel


class RunListItem(BaseModel):
    id: int
    run_group_id: int
    checkpoint_id: int
    recipe_id: int
    endpoint_id: int | None
    status: str
    truncation_rate: float | None
    error: str | None
    submitted_by: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
