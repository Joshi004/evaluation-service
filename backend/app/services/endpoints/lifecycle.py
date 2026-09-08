"""Orchestrates the endpoint lifecycle: reuse a live endpoint if one
exists, otherwise submit a serve job, wait for it to become ready, open
a tunnel to it, and record the result. See
docs/IMPLEMENTATION_PHASES.md Phase 3, item 5, and the confirmed
D-blocking decision: this blocks synchronously until the endpoint is
ready or has failed -- no background task, no polling, no status column.

Structured so no database transaction is ever open across an SSH call
(Trap T2 / .cursor/rules/dev-workflow.mdc): every DB write below commits
immediately, and the slow work in between -- submit, the readiness
poll, opening the tunnel -- touches no session state at all.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Checkpoint, Endpoint, ServingProfile
from app.services.cluster import connector, serve_job, tunnel
from app.services.endpoints import queries

logger = logging.getLogger(__name__)

settings = get_settings()

# Mirrors the script's own budget (Appendix A: 180 attempts x 5s = 900s)
# plus a little margin for the log write/read round trip, rather than
# inventing a different number the two could drift apart on.
_READINESS_POLL_INTERVAL_SECONDS = 5
_READINESS_POLL_ATTEMPTS = 190


class ServerDiedError(Exception):
    """The vLLM process exited before becoming ready -- a bad config or
    a crash to surface immediately (Trap T6), not a timeout worth
    retrying.
    """

    def __init__(self, exit_code: int | None, elapsed_seconds: int | None) -> None:
        self.exit_code = exit_code
        self.elapsed_seconds = elapsed_seconds
        super().__init__(f"vLLM server died after {elapsed_seconds}s, exit code {exit_code}")


class ReadinessTimeoutError(Exception):
    """vLLM never answered /v1/models within the readiness window."""

    def __init__(self, elapsed_seconds: int) -> None:
        self.elapsed_seconds = elapsed_seconds
        super().__init__(f"vLLM server did not become ready within {elapsed_seconds}s")


async def start_or_reuse_endpoint(
    db: AsyncSession, checkpoint: Checkpoint, serving_profile: ServingProfile
) -> Endpoint:
    """The reuse-or-start sequence (Phase 3, item 5)."""
    reusable = await queries.find_reusable_endpoint(db, checkpoint.id, serving_profile.id)
    if reusable is not None:
        logger.info("reusing endpoint %d for checkpoint %d", reusable.id, checkpoint.id)
        return reusable

    # Written before the serve job is even submitted (Trap T3): the
    # walltime clock starts when SLURM starts the job, not when vLLM
    # finishes loading, so expires_at has to be set from here, not from
    # whenever readiness happens to complete.
    expires_at = datetime.now(UTC) + timedelta(seconds=settings.slurm_walltime_seconds)
    endpoint = await queries.create_endpoint_row(db, checkpoint.id, serving_profile.id, expires_at)

    script = serve_job.render_serve_script(
        checkpoint, serving_profile, settings.slurm_walltime_seconds
    )
    slurm_job_id = await connector.submit(script)
    logger.info("submitted serve job %d for endpoint %d", slurm_job_id, endpoint.id)
    updated = await queries.set_slurm_job_id(db, endpoint.id, slurm_job_id)
    assert updated is not None  # the row above was just created in this same call
    endpoint = updated

    log_path = serve_job.log_path(settings.cluster_log_root, slurm_job_id)
    await _wait_for_ready(log_path, slurm_job_id)

    remote_port = serve_job.compute_port(slurm_job_id)
    url = await tunnel.ensure_tunnel(endpoint.id, slurm_job_id, remote_port)
    updated = await queries.set_endpoint_url(db, endpoint.id, url)
    assert updated is not None
    return updated


async def _wait_for_ready(log_path: str, slurm_job_id: int) -> None:
    """Polls the serve job's log for a terminal marker (Trap T5: read
    the markers, never infer readiness from job state -- RUNNING means
    SLURM started the script, which is about six minutes before vLLM
    actually answers). On a timeout this also cancels the job before
    raising, so a stuck server doesn't hold its GPU for the rest of
    --time.
    """
    for attempt in range(_READINESS_POLL_ATTEMPTS):
        text = await connector.logs(log_path, follow=False)
        assert isinstance(text, str)  # follow=False always returns the full text, never a stream
        event = serve_job.parse_serve_log(text)

        if event.status == "ready":
            return
        if event.status == "server_died":
            raise ServerDiedError(event.exit_code, event.elapsed_seconds)
        if event.status == "readiness_timeout":
            await connector.cancel(slurm_job_id)
            raise ReadinessTimeoutError(attempt * _READINESS_POLL_INTERVAL_SECONDS)

        await asyncio.sleep(_READINESS_POLL_INTERVAL_SECONDS)

    # Our own belt-and-suspenders bound, reached only if the script
    # itself hung before ever writing its own READINESS_TIMEOUT marker
    # (e.g. a wedged curl) -- the script's 900s budget should always
    # fire first.
    await connector.cancel(slurm_job_id)
    raise ReadinessTimeoutError(_READINESS_POLL_ATTEMPTS * _READINESS_POLL_INTERVAL_SECONDS)


async def kill_endpoint(db: AsyncSession, endpoint_id: int) -> Endpoint | None:
    """The kill button: cancel the SLURM job if one was submitted, close
    our side of the tunnel, and expire the row. Returns None if the
    endpoint doesn't exist, so the router can 404.
    """
    endpoint = await queries.get_endpoint(db, endpoint_id)
    if endpoint is None:
        return None
    if endpoint.slurm_job_id is not None:
        await connector.cancel(endpoint.slurm_job_id)
    await tunnel.close_tunnel(endpoint_id)
    return await queries.expire_endpoint(db, endpoint_id)
