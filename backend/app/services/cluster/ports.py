"""The `ClusterRuntime` port -- the interface between the application
and SSH/SLURM. Everything outside `backend/app/services/cluster/`
depends on this module and nothing else cluster-shaped: no log path, no
SLURM job id format, no readiness marker, no compute node, no port
formula. See docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 1.

This module is pure contract -- no ORM import, no `asyncssh` import, no
I/O. `ssh_slurm_runtime.py` is what gives these shapes meaning today;
a future implementation elsewhere needs only this module.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class ServeJobSpec:
    """Everything a runtime needs to start a serving job, structured
    rather than a rendered script (R-D3) -- rendering an sbatch script
    out of this is the SSH/SLURM adapter's private business.
    """

    model_reference: str
    served_name: str
    gpus: int
    walltime_seconds: int
    engine_args: list[str]
    max_model_len: int | None


@dataclass(frozen=True)
class JobHandle:
    """A handle, not a bare int, so a future implementation can carry an
    opaque id without a signature change.
    """

    job_id: int


@dataclass(frozen=True)
class JobState:
    """Replaces today's `"RUNNING health-35"` string, which callers used
    to split themselves. `node` is `None` for a job with none assigned
    yet (still pending) or no longer known to SLURM.
    """

    state: str
    node: str | None


@dataclass(frozen=True)
class ServingAddress:
    node: str
    port: int


class ServerDiedError(Exception):
    """The vLLM process exited before becoming ready -- a bad config or
    a crash to surface immediately, not a timeout worth retrying.
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


@runtime_checkable
class ClusterRuntime(Protocol):
    """Submit, status, and cancel are the core contract. Readiness,
    tunnelling, log streaming, and tunnel teardown are on the same port
    because they are all "operate a running job" -- the alternative is
    worse: some other layer would have to learn about log markers,
    compute node names, and port formulas, which is exactly the leak
    this port exists to prevent (R-D2). A future cluster-management
    service implements all seven.
    """

    async def submit_job(self, spec: ServeJobSpec) -> JobHandle: ...

    async def job_status(self, job_ids: list[int]) -> dict[int, JobState]: ...

    async def cancel_job(self, job_id: int) -> None: ...

    async def wait_until_serving(self, handle: JobHandle) -> ServingAddress: ...

    async def open_serving_tunnel(self, endpoint_id: int, handle: JobHandle) -> str: ...

    async def close_serving_tunnel(self, endpoint_id: int) -> None: ...

    async def job_logs(self, handle: JobHandle, follow: bool) -> str | AsyncIterator[str]: ...


# ModelDiscovery (Phase 2): list_checkpoint_candidates / inspect_checkpoint
# / validate_checkpoint. Not defined here yet -- this phase changes no
# discovery behaviour, and stubbed methods would just be dead code to
# delete later.
