"""The SSH/SLURM implementation of the `ClusterRuntime` port.

Thin by design: every SSH/SLURM detail already lives in `connector.py`,
`serve_job.py`, and `tunnel.py` -- this class only assembles their calls
into the seven port methods `ports.ClusterRuntime` declares.
`wait_until_serving` is the one method with real logic of its own: it is
`lifecycle._wait_for_ready` moved here verbatim, because readiness is
read from log markers, never inferred from job state (R-T2) -- SLURM
`RUNNING` means the script started, about six minutes before vLLM
answers.
"""

import asyncio
from collections.abc import AsyncIterator

from app.config import get_settings
from app.services.cluster import connector, serve_job, tunnel
from app.services.cluster.ports import (
    JobHandle,
    JobState,
    ReadinessTimeoutError,
    ServeJobSpec,
    ServerDiedError,
    ServingAddress,
)

settings = get_settings()

# Mirrors the script's own budget (Appendix A: 180 attempts x 5s = 900s)
# plus a little margin for the log write/read round trip, rather than
# inventing a different number the two could drift apart on.
_READINESS_POLL_INTERVAL_SECONDS = 5
_READINESS_POLL_ATTEMPTS = 190


class SshSlurmClusterRuntime:
    """`ClusterRuntime` over `asyncssh` and SLURM's CLI tools -- the only
    implementation today. `get_cluster_runtime()` in `__init__.py` is
    the one place that constructs it (R-D12); a future implementation is
    a one-line change there, not here.
    """

    async def submit_job(self, spec: ServeJobSpec) -> JobHandle:
        script = serve_job.render_serve_script(spec)
        job_id = await connector.submit(script)
        return JobHandle(job_id=job_id)

    async def job_status(self, job_ids: list[int]) -> dict[int, JobState]:
        return await connector.status(job_ids)

    async def cancel_job(self, job_id: int) -> None:
        await connector.cancel(job_id)

    async def wait_until_serving(self, handle: JobHandle) -> ServingAddress:
        """Polls the serve job's log for a terminal marker (R-T2: read
        the markers, never infer readiness from job state). On a timeout
        this also cancels the job before raising, so a stuck server
        doesn't hold its GPU for the rest of --time.
        """
        log_path = serve_job.log_path(settings.cluster_log_root, handle.job_id)
        for attempt in range(_READINESS_POLL_ATTEMPTS):
            text = await connector.logs(log_path, follow=False)
            assert isinstance(text, str)  # follow=False always returns full text, never a stream
            event = serve_job.parse_serve_log(text)

            if event.status == "ready":
                assert event.node is not None  # SERVE_NODE is echoed before the readiness loop
                port = serve_job.compute_port(handle.job_id)
                return ServingAddress(node=event.node, port=port)
            if event.status == "server_died":
                raise ServerDiedError(event.exit_code, event.elapsed_seconds)
            if event.status == "readiness_timeout":
                await connector.cancel(handle.job_id)
                raise ReadinessTimeoutError(attempt * _READINESS_POLL_INTERVAL_SECONDS)

            await asyncio.sleep(_READINESS_POLL_INTERVAL_SECONDS)

        # Our own belt-and-suspenders bound, reached only if the script
        # itself hung before ever writing its own READINESS_TIMEOUT
        # marker (e.g. a wedged curl) -- the script's 900s budget should
        # always fire first.
        await connector.cancel(handle.job_id)
        raise ReadinessTimeoutError(_READINESS_POLL_ATTEMPTS * _READINESS_POLL_INTERVAL_SECONDS)

    async def open_serving_tunnel(self, endpoint_id: int, handle: JobHandle) -> str:
        remote_port = serve_job.compute_port(handle.job_id)
        return await tunnel.ensure_tunnel(endpoint_id, handle.job_id, remote_port)

    async def close_serving_tunnel(self, endpoint_id: int) -> None:
        await tunnel.close_tunnel(endpoint_id)

    async def job_logs(self, handle: JobHandle, follow: bool) -> str | AsyncIterator[str]:
        log_path = serve_job.log_path(settings.cluster_log_root, handle.job_id)
        return await connector.logs(log_path, follow=follow)
