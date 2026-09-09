"""Spawns one harness container per run and waits for it to finish.

The container is created by the *host* Docker daemon over the mounted
socket, not by this process directly -- see the `output_root` /
`output_root_host_path` split in app/config.py. Everything in this
module that names a filesystem path is explicit about which side of
that split it's on.
"""

import asyncio
import json
import logging
import shlex
from pathlib import Path

from app.config import get_settings
from app.models import Checkpoint, Endpoint, Recipe
from app.services.harness.task_config import build_task_config

logger = logging.getLogger(__name__)

settings = get_settings()

# Where the task config lands inside the harness container, and the
# root the container's own output tree (configs/logs/predictions/
# reports/reviews) is written under -- fixed, because it's a path
# inside a container we define, not something any caller chooses.
_CONTAINER_WORK_DIR = "/work"

# "Tail" per the doc's own exit-test use of `tail -60`: enough lines to
# show the actual error (a Python traceback, an EvalScope assertion)
# without carrying a whole run's log into eval_run.error.
_STDOUT_TAIL_LINES = 60


class HarnessFailedError(Exception):
    """The harness container exited non-zero -- a bad task config or a
    crash inside EvalScope, to surface with enough context to act on
    (like ServerDiedError in services/cluster/ports.py), not just
    "the run failed".
    """

    def __init__(self, exit_code: int | None, stdout_tail: str) -> None:
        self.exit_code = exit_code
        self.stdout_tail = stdout_tail
        super().__init__(f"harness container exited {exit_code}, last output:\n{stdout_tail}")


def run_directory(eval_run_id: int) -> Path:
    """Where this run's output tree lives, as this backend process sees
    it -- `{output_root}/run-{id}`. Pure path arithmetic, no I/O: safe
    to call before the directory exists (runner.py creates it) or after
    the run is long done (parser.py just reads under it).
    """
    return Path(settings.output_root) / f"run-{eval_run_id}"


def _host_run_directory(eval_run_id: int) -> str:
    """The same directory, as a path on the *host* -- what a bind mount
    source given to `docker run -v` must be, because the harness
    container is created by the host daemon and never sees this
    process's own mount namespace (see app/config.py).
    """
    return f"{settings.output_root_host_path.rstrip('/')}/run-{eval_run_id}"


def _container_name(eval_run_id: int) -> str:
    """The one name both `run_harness` (below) and `kill_harness_container`
    use -- a single function so cancel's `docker kill` can never target a
    different name than `docker run --name` actually used.
    """
    return f"evalsvc-harness-run-{eval_run_id}"


async def run_harness(
    recipe: Recipe, checkpoint: Checkpoint, endpoint: Endpoint, eval_run_id: int
) -> None:
    """Builds the task config, writes it into the run directory, and
    runs the harness container to completion against it.

    Long-running by design (Trap T1: `run_task()` itself blocks) --
    this `await` is meant to take as long as the eval does. No timeout
    wrapper here; Phase 5's per-run task is where that gets managed.
    Raises HarnessFailedError on a non-zero exit.
    """
    run_dir = run_directory(eval_run_id)
    run_dir.mkdir(parents=True, exist_ok=True)

    config = build_task_config(recipe, checkpoint, endpoint, _CONTAINER_WORK_DIR)
    config_path = run_dir / "harness_task_config.json"
    config_path.write_text(json.dumps(config, indent=2))

    argv = [
        "docker",
        "run",
        "--rm",
        "--name",
        _container_name(eval_run_id),
        "--network",
        settings.harness_docker_network,
        "-v",
        f"{_host_run_directory(eval_run_id)}:{_CONTAINER_WORK_DIR}",
        settings.harness_image,
        f"{_CONTAINER_WORK_DIR}/harness_task_config.json",
    ]
    # A single copy-pasteable line -- when a run fails the first
    # question is always "what did we actually invoke".
    logger.debug("harness invocation: %s", shlex.join(argv))

    process = await asyncio.create_subprocess_exec(
        *argv,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    assert process.stdout is not None  # guaranteed by stdout=PIPE above

    log_path = run_dir / "harness_stdout.log"
    output = bytearray()
    with log_path.open("wb") as log_file:
        while True:
            # Chunked, not line-by-line: StreamReader.readline() (which
            # line iteration uses internally) raises if a single line
            # exceeds its buffer, and a progress bar or a long JSON
            # blob printed without a newline is a real way for that to
            # happen here.
            chunk = await process.stdout.read(65536)
            if not chunk:
                break
            log_file.write(chunk)
            output.extend(chunk)

    exit_code = await process.wait()
    if exit_code != 0:
        tail_lines = output.decode("utf-8", errors="replace").splitlines()[-_STDOUT_TAIL_LINES:]
        raise HarnessFailedError(exit_code=exit_code, stdout_tail="\n".join(tail_lines))


async def kill_harness_container(eval_run_id: int) -> None:
    """Best-effort `docker kill` on this run's harness container, for
    cancel (Phase 5, Trap T4's sibling problem): cancelling the asyncio
    task awaiting `run_harness` above does not stop the `docker run`
    child it started, which would otherwise keep running and keep the
    endpoint busy as an orphan.

    A run cancelled before the harness container ever started (still
    waiting on an endpoint) has no matching container -- `docker kill`
    exits non-zero for that case, logged and swallowed rather than
    raised, since by definition there is nothing left to kill.
    """
    container_name = _container_name(eval_run_id)
    process = await asyncio.create_subprocess_exec(
        "docker",
        "kill",
        container_name,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    assert process.stdout is not None  # guaranteed by stdout=PIPE above
    output = await process.stdout.read()
    await process.wait()
    if process.returncode != 0:
        logger.info(
            "docker kill %s exited %d (likely already stopped, or never started): %s",
            container_name,
            process.returncode,
            output.decode("utf-8", errors="replace").strip(),
        )
