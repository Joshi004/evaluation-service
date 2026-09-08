"""Request/response shapes for /api/v1/endpoints."""

from datetime import datetime

from pydantic import BaseModel


class EndpointListItem(BaseModel):
    id: int
    checkpoint_id: int
    checkpoint_name: str
    serving_profile_id: int
    # The GPU count this one live endpoint holds -- shown per row so a
    # human can total GPU usage across the page by eye (Phase 3, "the
    # GPUs a submit costs" -- for an endpoint, that's serving_profile.gpus,
    # not the number of eval_runs sharing it).
    gpus: int
    slurm_job_id: int | None
    url: str | None
    expires_at: datetime
    created_at: datetime


class CreateEndpointRequest(BaseModel):
    """POST body to start (or reuse) an endpoint. serving_profile_id is
    deliberately not here -- each checkpoint already has exactly one, so
    there's nothing for a client to choose between; the controller reads
    it from the checkpoint row.
    """

    checkpoint_id: int
