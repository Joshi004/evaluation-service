"""Cluster resource: today, just the SLURM partition listing behind the
Submit page's partition picker. Decision D5 (no general Cluster page)
still holds -- this is one narrow route, not a browsable resource.
"""

from fastapi import APIRouter, HTTPException

from app.controllers import cluster as cluster_controller
from app.schemas.cluster import ClusterPartitions
from app.services.cluster.ports import ClusterUnreachableError

router = APIRouter()


@router.get("/partitions", response_model=ClusterPartitions)
async def list_partitions() -> ClusterPartitions:
    """No `db` dependency here, unlike every other route in v1 -- this
    reads only the cluster and Settings.slurm_partition.
    """
    try:
        return await cluster_controller.list_partitions()
    except ClusterUnreachableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
