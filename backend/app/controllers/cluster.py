"""Cluster controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.

No `db` parameter anywhere in this module, unlike its siblings: the one
operation here, listing partitions, reads nothing but the cluster and
Settings.slurm_partition.
"""

from app.config import get_settings
from app.schemas.cluster import ClusterPartitions
from app.services.cluster import get_cluster_runtime

settings = get_settings()


async def list_partitions() -> ClusterPartitions:
    """ports.ClusterUnreachableError propagates past this unchanged;
    the router maps it to 503, same as the checkpoint candidates route.
    """
    runtime = get_cluster_runtime()
    partitions = await runtime.list_partitions()
    return ClusterPartitions(default_partition=settings.slurm_partition, partitions=partitions)
