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
from app.services.cluster.ports import JobHandle, ServeJobSpec
from app.services.endpoints import queries
from app.services.serving_profiles.render import render_engine_args

logger = logging.getLogger(__name__)

settings = get_settings()


async def start_or_reuse_endpoint(
    db: AsyncSession, checkpoint: Checkpoint, serving_profile: ServingProfile, partition: str
) -> Endpoint:
    """The reuse-or-start sequence (Phase 3, item 5).

    `partition` only ever governs a *new* serve job: reuse stays keyed
    on `(checkpoint_id, serving_profile_id)` alone (per-run SLURM
    partition selection -- see `endpoint.py`'s own reuse-key comment),
    so a run can be handed back a live endpoint that's actually running
    on a different partition than the one it asked for. That's
    deliberate -- paying for a second cold start just to match a
    partition would cost real GPU-minutes for no measurement benefit.
    """
    reusable = await queries.find_reusable_endpoint(db, checkpoint.id, serving_profile.id)
    if reusable is not None and await _reconnect_if_still_running(db, reusable):
        logger.info(
            "reusing endpoint %d for checkpoint %d (requested partition %r, endpoint is on %r)",
            reusable.id,
            checkpoint.id,
            partition,
            reusable.partition,
        )
        return reusable

    runtime = get_cluster_runtime()

    # Written before the serve job is even submitted (Trap T3): the
    # walltime clock starts when SLURM starts the job, not when vLLM
    # finishes loading, so expires_at has to be set from here, not from
    # whenever readiness happens to complete.
    expires_at = datetime.now(UTC) + timedelta(seconds=settings.slurm_walltime_seconds)
    endpoint = await queries.create_endpoint_row(
        db, checkpoint.id, serving_profile.id, expires_at, partition
    )

    spec = ServeJobSpec(
        model_reference=checkpoint.path,
        served_name=checkpoint.name,
        gpus=serving_profile.gpus,
        walltime_seconds=settings.slurm_walltime_seconds,
        engine_args=render_engine_args(serving_profile),
        partition=partition,
    )
    try:
        handle = await runtime.submit_job(spec)
    except Exception:
        # The row above has no slurm_job_id and no url yet -- without
        # this, a rejected submission (most commonly now: a partition
        # this account can't use, per-run SLURM partition selection)
        # would leave it sitting on the Endpoints page, counting its
        # GPUs (Trap T1), for the rest of --time even though nothing is
        # actually running.
        await queries.expire_endpoint(db, endpoint.id)
        raise
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


async def _reconnect_if_still_running(db: AsyncSession, endpoint: Endpoint) -> bool:
    """Whether a reusable row's server can actually take requests. The
    row alone can't tell a healthy server from one whose tunnel dropped
    (a lost login-node SSH connection or a backend reload closes every
    tunnel) or whose job already ended.

    True: SLURM still reports the serve job RUNNING and its tunnel is
    open. `open_serving_tunnel` is a no-op for a tunnel that's still up
    and rebuilds one that dropped, always on the row's own `url` (the
    local port is derived from the job id), so the row needs no update.

    False: SLURM no longer runs the job. The row is expired and its
    tunnel closed, so it stops being listed or handed out, and the
    caller starts a new server instead.
    """
    assert endpoint.slurm_job_id is not None, (
        "a reusable endpoint always has a slurm_job_id (set before url, in that order)"
    )
    runtime = get_cluster_runtime()
    job_states = await runtime.job_status([endpoint.slurm_job_id])
    job_state = job_states[endpoint.slurm_job_id]
    if job_state.state != "RUNNING":
        logger.warning(
            "endpoint %d: serve job %d is %s, not RUNNING -- expiring it instead of reusing it",
            endpoint.id,
            endpoint.slurm_job_id,
            job_state.state,
        )
        await runtime.close_serving_tunnel(endpoint.id)
        await queries.expire_endpoint(db, endpoint.id)
        return False

    await runtime.open_serving_tunnel(endpoint.id, JobHandle(job_id=endpoint.slurm_job_id))
    return True


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
