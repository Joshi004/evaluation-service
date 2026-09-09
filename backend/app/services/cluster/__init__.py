"""The cluster port and its SSH/SLURM implementation.

`ClusterRuntime` (`ports.py`) is the interface everything outside this
package depends on instead of knowing SSH or SLURM is involved at all
(docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 1). `get_cluster_runtime()`
below is the one accessor -- a module-level singleton (R-D12), not a
FastAPI dependency, because background workers call it too and have no
request scope.

- `ports.py` -- the `ClusterRuntime` Protocol and its DTOs/exceptions.
- `ssh_slurm_runtime.py` -- `SshSlurmClusterRuntime`, the only
  implementation today.
- `connector.py`, `serve_job.py`, `tunnel.py` -- private to this
  package: the actual `asyncssh` connection, sbatch script rendering,
  and tunnel supervision. Nothing outside `services/cluster/` imports
  them.
"""

from functools import lru_cache

from app.services.cluster.ports import ClusterRuntime
from app.services.cluster.ssh_slurm_runtime import SshSlurmClusterRuntime

__all__ = ["get_cluster_runtime"]


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
