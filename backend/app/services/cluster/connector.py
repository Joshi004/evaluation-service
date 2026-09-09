"""The SSH connector to the SLURM cluster -- originally a six-method
interface everything above this module depended on directly (see
docs/IMPLEMENTATION_PHASES.md Phase 3). As of
docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 1, this module is private
to `services/cluster/`: `ssh_slurm_runtime.py` and, as of Phase 2,
`ssh_model_discovery.py` are its only callers, and it exists behind the
`ClusterRuntime` / `ModelDiscovery` ports so nothing above this package
knows SSH is involved at all. Phase 2 adds three read-only primitives
(`run_command`, `read_remote_texts`, `list_remote_directories`) for
discovery to build on, so it never has to import `asyncssh` itself.

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
from datetime import UTC, datetime

import asyncssh

from app.config import get_settings
from app.services.cluster.ports import ClusterUnreachableError, JobState

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


@dataclass(frozen=True)
class CommandResult:
    """One command's result over the pooled login connection -- exit
    status alongside stdout/stderr, so discovery's `find` and `du` calls
    (services/cluster/ssh_model_discovery.py) never need asyncssh's own
    process-result type to leak past this module.
    """

    exit_status: int
    stdout: str
    stderr: str


@dataclass(frozen=True)
class RemoteDirectoryEntry:
    """One entry from a remote directory listing -- name, whether it is
    itself a directory, and the two attributes discovery needs: size
    and modification time. `modified_at` is None on the rare server that
    doesn't report an mtime for an entry.
    """

    name: str
    is_directory: bool
    size_bytes: int
    modified_at: datetime | None


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
            try:
                _login_connection = await asyncssh.connect(
                    settings.cluster_ssh_host,
                    port=settings.cluster_ssh_port,
                    username=settings.cluster_ssh_user,
                    client_keys=[settings.cluster_ssh_key_path],
                    known_hosts=settings.cluster_ssh_known_hosts_path,
                    keepalive_interval=30,
                    keepalive_count_max=3,
                )
            except (OSError, asyncssh.Error) as exc:
                # Discovery (Phase 2) is the first caller that needs to
                # tell "the cluster is down" apart from "this reference
                # is bad" -- the run path has no caller that catches
                # this, so its behaviour (an uncaught exception, a 500)
                # is unchanged.
                raise ClusterUnreachableError(
                    f"could not reach cluster login node {settings.cluster_ssh_host}"
                ) from exc
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


async def status(job_ids: list[int]) -> dict[int, JobState]:
    """One bulk squeue call, never one per job -- the node the lifecycle
    needs at tunnel time travels in the same call, rather than a second
    call to fetch it. 0.7's "never trust a stored node name" rule means
    callers re-run this rather than caching a node from an earlier call.
    A job squeue no longer knows about (finished or cancelled) maps to
    state "UNKNOWN" with no node; a still-pending job with no node
    assigned yet maps to its state with `node=None`.
    """
    conn = await _get_login_connection()
    ids = ",".join(str(job_id) for job_id in job_ids)
    result = await conn.run(
        f"squeue -j {ids} -h -o '%i %T %N'",
        check=False,  # squeue exits non-zero once none of the ids exist any more
        timeout=_COMMAND_TIMEOUT_SECONDS,
    )
    found: dict[int, JobState] = {}
    for line in result.stdout.splitlines():
        fields = line.split(maxsplit=2)
        if len(fields) < 2:
            continue
        job_id_str, state = fields[0], fields[1]
        node = fields[2] if len(fields) > 2 else None
        found[int(job_id_str)] = JobState(state=state, node=node)
    unknown = JobState(state="UNKNOWN", node=None)
    return {job_id: found.get(job_id, unknown) for job_id in job_ids}


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
    """`tail -f` over SSH, closed in a `finally` (Phase 6 addition) so a
    subscriber that stops consuming this generator early -- an abandoned
    browser tab, or its own run reaching a terminal status -- always
    closes the remote channel instead of leaking a `tail -f` process on
    the login node (Trap T3). Cancelling the task that owns this
    generator's `async for` throws into this exact frame, which is what
    makes that cleanup run even though nothing here calls `.aclose()`
    directly.
    """
    process = await conn.create_process(f"tail -f {path}")
    try:
        async for line in process.stdout:
            yield line
    finally:
        process.close()


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


# --- Discovery primitives (Phase 2) ---
#
# ssh_model_discovery.py is the only caller. `find` and `du` stay shell
# commands (R-D9: doing a tree walk over SFTP would be hundreds of
# round trips), while reading a config file or listing a directory's
# attributes goes over SFTP, which has no shell to inject into at all.


async def run_command(command: str) -> CommandResult:
    """One arbitrary command over the pooled login connection, with the
    same timeout every other connector call uses (R-T7). `check=False`,
    same as `status()` above -- the caller decides what a non-zero exit
    means, because a `find` that matches nothing and a `du` on a
    missing path both exit non-zero without that being a connector
    failure.
    """
    conn = await _get_login_connection()
    result = await conn.run(command, check=False, timeout=_COMMAND_TIMEOUT_SECONDS)
    exit_status = result.exit_status if result.exit_status is not None else -1
    return CommandResult(exit_status=exit_status, stdout=result.stdout, stderr=result.stderr)


async def read_remote_texts(paths: list[str]) -> dict[str, str | None]:
    """Reads several remote text files over one SFTP session. A file
    that is missing, unreadable, or not valid UTF-8 maps to None rather
    than raising (R-D15: a partial inspection is still a success) --
    only a dead connection escapes this function.
    """
    conn = await _get_login_connection()
    texts: dict[str, str | None] = {}
    async with conn.start_sftp_client() as sftp:
        for path in paths:
            try:
                async with sftp.open(path, "r") as remote_file:
                    texts[path] = await remote_file.read()
            except (asyncssh.SFTPError, OSError, UnicodeDecodeError):
                texts[path] = None
    return texts


async def list_remote_directories(paths: list[str]) -> dict[str, list[RemoteDirectoryEntry]]:
    """Reads several remote directories' contents over one SFTP session.
    A directory that is missing or unreadable maps to an empty list,
    for the same reason read_remote_texts maps a bad file to None.
    """
    conn = await _get_login_connection()
    listings: dict[str, list[RemoteDirectoryEntry]] = {}
    async with conn.start_sftp_client() as sftp:
        for path in paths:
            try:
                entries = await sftp.readdir(path)
            except (asyncssh.SFTPError, OSError):
                listings[path] = []
                continue
            listings[path] = [
                RemoteDirectoryEntry(
                    name=str(entry.filename),
                    is_directory=entry.attrs.type == asyncssh.FILEXFER_TYPE_DIRECTORY,
                    size_bytes=entry.attrs.size or 0,
                    modified_at=(
                        datetime.fromtimestamp(entry.attrs.mtime, tz=UTC)
                        if entry.attrs.mtime is not None
                        else None
                    ),
                )
                for entry in entries
                if entry.filename not in (".", "..")
            ]
    return listings
