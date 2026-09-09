"""The `ClusterRuntime` and `ModelDiscovery` ports -- the interface
between the application and SSH/SLURM. Everything outside
`backend/app/services/cluster/` depends on this module and nothing else
cluster-shaped: no log path, no SLURM job id format, no readiness
marker, no compute node, no port formula. See
docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 1 (`ClusterRuntime`) and
Phase 2 (`ModelDiscovery`).

This module is pure contract -- no ORM import, no `asyncssh` import, no
I/O. `ssh_slurm_runtime.py` and `ssh_model_discovery.py` are what give
these shapes meaning today; a future implementation elsewhere needs
only this module. It imports the discovery DTOs from
`app.schemas.discovery` rather than redefining them -- they cross the
API boundary too, so Pydantic earns its keep there, and one definition
keeps the port and the wire response from drifting apart.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from app.schemas.discovery import CheckpointAvailability, CheckpointCandidate, CheckpointInspection


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


class ClusterUnreachableError(Exception):
    """The login node itself could not be reached -- e.g. the SSH
    connect failed. Distinct from an invalid reference or an unreadable
    candidate, which are about one file or directory rather than the
    cluster being reachable at all.
    """


@runtime_checkable
class ModelDiscovery(Protocol):
    """Browse, inspect, and validate checkpoint candidates on the
    cluster -- three read-only operations, none of which write to the
    database (R-D14: this port takes no session and imports no ORM
    model). `reference` is the opaque handle naming one candidate; it is
    an absolute NFS path today, but nothing above this port may assume
    that (Section 0.5).
    """

    async def list_checkpoint_candidates(self) -> list[CheckpointCandidate]: ...

    async def inspect_checkpoint(self, reference: str) -> CheckpointInspection: ...

    async def validate_checkpoint(self, reference: str) -> CheckpointAvailability: ...
