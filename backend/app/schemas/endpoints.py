"""Response shape for GET /api/v1/endpoints.

Returns [] this phase -- no endpoint rows are written until Phase 3
starts a vLLM server on the cluster.
"""

from datetime import datetime

from pydantic import BaseModel


class EndpointListItem(BaseModel):
    id: int
    checkpoint_id: int
    serving_profile_id: int
    slurm_job_id: int | None
    url: str | None
    expires_at: datetime
    created_at: datetime
