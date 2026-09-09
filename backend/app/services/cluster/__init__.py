"""The cluster ports and their SSH/SLURM implementations.

`ClusterRuntime` and `ModelDiscovery` (`ports.py`) are the interfaces
everything outside this package depends on instead of knowing SSH or
SLURM is involved at all (docs/CHECKPOINT_REGISTRATION_PHASES.md Phase
1 and Phase 2). `get_cluster_runtime()` and `get_model_discovery()`
below are the two accessors -- module-level singletons (R-D12), not
FastAPI dependencies, because background workers call the former too
and have no request scope.

- `ports.py` -- the `ClusterRuntime` / `ModelDiscovery` Protocols and
  their DTOs/exceptions.
- `ssh_slurm_runtime.py` -- `SshSlurmClusterRuntime`, the only
  `ClusterRuntime` implementation today.
- `ssh_model_discovery.py` -- `SshModelDiscovery`, the only
  `ModelDiscovery` implementation today.
- `connector.py`, `serve_job.py`, `tunnel.py` -- private to this
  package: the actual `asyncssh` connection, sbatch script rendering,
  and tunnel supervision. Nothing outside `services/cluster/` imports
  them.
"""

from functools import lru_cache

from app.services.cluster.ports import ClusterRuntime, ModelDiscovery
from app.services.cluster.ssh_model_discovery import SshModelDiscovery
from app.services.cluster.ssh_slurm_runtime import SshSlurmClusterRuntime

__all__ = ["get_cluster_runtime", "get_model_discovery"]


@lru_cache
def get_cluster_runtime() -> ClusterRuntime:
    """One cluster, one login connection, one process (R-D12) -- a DI
    container here would be ceremony. A second implementation is a
    one-line change to this function, which is the whole point of the
    port existing.
    """
    runtime = SshSlurmClusterRuntime()
    # @runtime_checkable only checks method presence, not signatures --
    # enough to catch a method renamed on one side of the port (R-D11),
    # cheaply, at startup.
    assert isinstance(runtime, ClusterRuntime)
    return runtime


@lru_cache
def get_model_discovery() -> ModelDiscovery:
    """Same reasoning as `get_cluster_runtime()` above -- one cluster,
    one login connection, one process. A second implementation is a
    one-line change here.
    """
    discovery = SshModelDiscovery()
    assert isinstance(discovery, ModelDiscovery)
    return discovery
