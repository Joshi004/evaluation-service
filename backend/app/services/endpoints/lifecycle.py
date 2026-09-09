"""Orchestrates the endpoint lifecycle: reuse a live endpoint if one
exists, otherwise submit a serve job, wait for it to become ready, open
a tunnel to it, and record the result. See
docs/IMPLEMENTATION_PHASES.md Phase 3, item 5, and the confirmed
D-blocking decision: this blocks synchronously until the endpoint is
ready or has failed -- no background task, no polling, no status column.

Structured so no database transaction is ever open across a cluster
runtime call (Trap T2 / .cursor/rules/dev-workflow.mdc; R-T4 of
docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 1): every DB write below
commits immediately, and the slow work in between -- submit, the
readiness poll, opening the tunnel -- touches no session state at all.

This module no longer knows SSH, SLURM, log paths, or port formulas --
all of that is behind `app.services.cluster.get_cluster_runtime()`
(Phase 1 of docs/CHECKPOINT_REGISTRATION_PHASES.md).
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Checkpoint, Endpoint, ServingProfile
from app.services.cluster import get_cluster_runtime
from app.services.cluster.ports import ServeJobSpec
from app.services.endpoints import queries
from app.services.serving_profiles.render import render_engine_args

logger = logging.getLogger(__name__)

settings = get_settings()


async def start_or_reuse_endpoint(
    db: AsyncSession, checkpoint: Checkpoint, serving_profile: ServingProfile
) -> Endpoint:
    """The reuse-or-start sequence (Phase 3, item 5)."""
    reusable = await queries.find_reusable_endpoint(db, checkpoint.id, serving_profile.id)
    if reusable is not None:
        logger.info("reusing endpoint %d for checkpoint %d", reusable.id, checkpoint.id)
        return reusable

    runtime = get_cluster_runtime()

    # Written before the serve job is even submitted (Trap T3): the
    # walltime clock starts when SLURM starts the job, not when vLLM
    # finishes loading, so expires_at has to be set from here, not from
    # whenever readiness happens to complete.
    expires_at = datetime.now(UTC) + timedelta(seconds=settings.slurm_walltime_seconds)
    endpoint = await queries.create_endpoint_row(db, checkpoint.id, serving_profile.id, expires_at)

    spec = ServeJobSpec(
        model_reference=checkpoint.path,
        served_name=checkpoint.name,
        gpus=serving_profile.gpus,
        walltime_seconds=settings.slurm_walltime_seconds,
        engine_args=render_engine_args(serving_profile),
    )
    handle = await runtime.submit_job(spec)
    logger.info("submitted serve job %d for endpoint %d", handle.job_id, endpoint.id)
    updated = await queries.set_slurm_job_id(db, endpoint.id, handle.job_id)
    assert updated is not None  # the row above was just created in this same call
    endpoint = updated

    address = await runtime.wait_until_serving(handle)
    logger.info("endpoint %d serving on %s:%d", endpoint.id, address.node, address.port)

    url = await runtime.open_serving_tunnel(endpoint.id, handle)
    updated = await queries.set_endpoint_url(db, endpoint.id, url)
    assert updated is not None
    return updated


async def kill_endpoint(db: AsyncSession, endpoint_id: int) -> Endpoint | None:
    """The kill button: cancel the SLURM job if one was submitted, close
    our side of the tunnel, and expire the row. Returns None if the
    endpoint doesn't exist, so the router can 404.
    """
    endpoint = await queries.get_endpoint(db, endpoint_id)
    if endpoint is None:
        return None
    runtime = get_cluster_runtime()
    if endpoint.slurm_job_id is not None:
        await runtime.cancel_job(endpoint.slurm_job_id)
    await runtime.close_serving_tunnel(endpoint_id)
    return await queries.expire_endpoint(db, endpoint_id)
