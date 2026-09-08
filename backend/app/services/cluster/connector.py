"""The SSH connector to the SLURM cluster -- the six-method interface
everything above this module depends on instead of knowing SSH is
involved at all. See docs/IMPLEMENTATION_PHASES.md Phase 3.

"Pooling" here means one shared, kept-alive connection to the login
node, reconnected on demand -- not a pool of several. asyncssh already
multiplexes many concurrent commands over a single connection, and
there is only ever one login node, so a pool of several would add
complexity with no benefit. A cold connect measured at ~16s, a reused
one at ~1s (CLUSTER_VALIDATION.md) -- holding this open is load-bearing,
not an optimisation.
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass

import asyncssh

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_login_connection: asyncssh.SSHClientConnection | None = None
_login_connection_lock = asyncio.Lock()

# Generous but finite -- a slow SSH call is not a failed one (Trap T1:
# sbatch measured at both 974ms and 29s during validation), but nothing
# here should be able to hang forever.
_COMMAND_TIMEOUT_SECONDS = 60


@dataclass
class LocalForward:
    """The local end of an open tunnel. Both pieces close together --
    closing only the listener would leave the compute-node connection
    dangling.
    """

    connection: asyncssh.SSHClientConnection
    listener: asyncssh.SSHListener
    local_port: int


async def _get_login_connection() -> asyncssh.SSHClientConnection:
    """The shared, kept-alive connection to the login node, reconnecting
    if it dropped or was never opened. Never call this while holding a
    database transaction open (see .cursor/rules/dev-workflow.mdc and
    Phase 3 Trap T2) -- a cold connect can take ~16s.
    """
    global _login_connection
    async with _login_connection_lock:
        if _login_connection is None or _login_connection.is_closed():
            logger.info("connecting to cluster login node %s", settings.cluster_ssh_host)
            _login_connection = await asyncssh.connect(
                settings.cluster_ssh_host,
                port=settings.cluster_ssh_port,
                username=settings.cluster_ssh_user,
                client_keys=[settings.cluster_ssh_key_path],
                known_hosts=settings.cluster_ssh_known_hosts_path,
                keepalive_interval=30,
                keepalive_count_max=3,
            )
        return _login_connection


async def submit(script: str) -> int:
    """sbatch, with the script on stdin -- nothing is staged on the
    cluster (0.7: "sbatch reads the script from stdin"). Returns the
    SLURM job id. `--chdir` is baked in here rather than a parameter, so
    this stays the exact signature the doc specifies.
    """
    conn = await _get_login_connection()
    result = await conn.run(
        f"sbatch --chdir={settings.cluster_log_root} --parsable",
        input=script,
        check=True,
        timeout=_COMMAND_TIMEOUT_SECONDS,
    )
    return int(result.stdout.strip())


async def status(job_ids: list[int]) -> dict[int, str]:
    """One bulk squeue call, never one per job. Each value is
    "<STATE> <NODE>" (e.g. "RUNNING health-35"), so the node the
    lifecycle needs at tunnel time travels in the same call without a
    seventh method -- 0.7's "never trust a stored node name" rule means
    callers re-run this rather than caching a node from an earlier call.
    A job squeue no longer knows about (finished or cancelled) maps to
    "UNKNOWN"; a still-pending job with no node assigned yet maps to
    "<STATE> " with an empty node.
    """
    conn = await _get_login_connection()
    ids = ",".join(str(job_id) for job_id in job_ids)
    result = await conn.run(
        f"squeue -j {ids} -h -o '%i %T %N'",
        check=False,  # squeue exits non-zero once none of the ids exist any more
        timeout=_COMMAND_TIMEOUT_SECONDS,
    )
    found: dict[int, str] = {}
    for line in result.stdout.splitlines():
        fields = line.split(maxsplit=2)
        if len(fields) < 2:
            continue
        job_id_str, state = fields[0], fields[1]
        node = fields[2] if len(fields) > 2 else ""
        found[int(job_id_str)] = f"{state} {node}".rstrip()
    return {job_id: found.get(job_id, "UNKNOWN") for job_id in job_ids}


async def cancel(job_id: int) -> None:
    """scancel. Synchronous -- there is no second writer to race with."""
    conn = await _get_login_connection()
    await conn.run(f"scancel {job_id}", check=True, timeout=_COMMAND_TIMEOUT_SECONDS)


async def logs(path: str, follow: bool = False) -> str | AsyncIterator[str]:
    """Logs are files on the shared NFS. `follow=False` (`cat`) is all
    this phase needs -- the readiness poll. `follow=True` (`tail -f`,
    streamed line by line) is the shape Phase 6's SSE log endpoint will
    consume; nothing in this phase calls it yet.
    """
    conn = await _get_login_connection()
    if follow:
        return _follow(conn, path)
    result = await conn.run(f"cat {path}", check=False, timeout=_COMMAND_TIMEOUT_SECONDS)
    return result.stdout


async def _follow(conn: asyncssh.SSHClientConnection, path: str) -> AsyncIterator[str]:
    process = await conn.create_process(f"tail -f {path}")
    async for line in process.stdout:
        yield line


async def stage_file(local_path: str, remote_path: str) -> None:
    """SFTP put. Not used in v1's run path -- kept so the six-method
    shape doesn't change later, per the doc.
    """
    conn = await _get_login_connection()
    async with conn.start_sftp_client() as sftp:
        await sftp.put(local_path, remote_path)


async def open_tunnel(node: str, remote_port: int) -> LocalForward:
    """ProxyJump through the login node straight to the compute node --
    one hop, since compute nodes are reachable directly with no active
    job (0.7). `known_hosts=None` here, unlike the login connection
    above: `main` assigns jobs across ~150 nodes, so pre-pinning every
    one isn't practical, and this hop already rides inside the
    host-key-verified login connection, which is where the real
    exposure to a network path we don't control lives.
    """
    login_conn = await _get_login_connection()
    compute_conn = await asyncssh.connect(
        node,
        username=settings.cluster_ssh_user,
        client_keys=[settings.cluster_ssh_key_path],
        known_hosts=None,
        tunnel=login_conn,
        keepalive_interval=30,
        keepalive_count_max=3,
    )
    # Local port == remote port (Trap T4): the port formula is already
    # collision-free per job, so reusing it here avoids a second formula
    # and a second collision problem. Bound on every interface, not just
    # loopback, so a sibling harness container can reach it (Phase 4) --
    # see tunnel.harness_facing_url().
    listener = await compute_conn.forward_local_port(
        "0.0.0.0", remote_port, "localhost", remote_port
    )
    return LocalForward(connection=compute_conn, listener=listener, local_port=remote_port)
