"""Supervised SSH tunnels -- one per live endpoint, rebuilt on demand
rather than trusted blindly. See docs/IMPLEMENTATION_PHASES.md Phase 3,
0.7: "never trust a stored node name" -- a stale hostname produces a
connection reset that looks exactly like a dead server, so any rebuild
re-reads the node from squeue first rather than reusing a cached value.
"""

import logging

from app.services.cluster import connector

logger = logging.getLogger(__name__)

# One open tunnel per endpoint id, held for the life of the process --
# the same module-level-state pattern as connector.py's single
# connection.
_open_tunnels: dict[int, connector.LocalForward] = {}


def harness_facing_url(local_port: int) -> str:
    """The address a sibling harness container reaches this tunnel at
    (Trap T4). "backend" is this container's own compose service name --
    reachable by any other container on the compose network without
    publishing the port on the host, because connector.open_tunnel binds
    the forward on every interface inside this container, not just
    loopback.
    """
    return f"http://backend:{local_port}/v1"


async def ensure_tunnel(endpoint_id: int, slurm_job_id: int, remote_port: int) -> str:
    """Returns the harness-facing URL for this endpoint's tunnel,
    opening or rebuilding it if necessary. Always re-reads the node from
    squeue first (via `_current_node`), every time -- the same call
    whether this is the first open or a reconnect after a failure, so
    there's no separate "trust the cached node" path to get wrong.
    """
    existing = _open_tunnels.get(endpoint_id)
    if existing is not None and not existing.connection.is_closed():
        return harness_facing_url(existing.local_port)

    if existing is not None:
        logger.warning("tunnel for endpoint %d died, rebuilding", endpoint_id)

    node = await _current_node(slurm_job_id)
    forward = await connector.open_tunnel(node, remote_port)
    _open_tunnels[endpoint_id] = forward
    return harness_facing_url(forward.local_port)


async def _current_node(slurm_job_id: int) -> str:
    """The compute node squeue currently reports for this job -- never
    the node a log line printed at submit time, per 0.7.
    """
    states = await connector.status([slurm_job_id])
    state_and_node = states[slurm_job_id]
    _, _, node = state_and_node.partition(" ")
    if not node:
        raise RuntimeError(
            f"cannot open a tunnel for job {slurm_job_id}: squeue reports "
            f"'{state_and_node}', no node assigned"
        )
    return node


async def close_tunnel(endpoint_id: int) -> None:
    """Closes and forgets the tunnel for a killed endpoint. A no-op if
    none was open (e.g. the endpoint never made it past submit).
    """
    forward = _open_tunnels.pop(endpoint_id, None)
    if forward is None:
        return
    forward.listener.close()
    forward.connection.close()
    await forward.connection.wait_closed()
