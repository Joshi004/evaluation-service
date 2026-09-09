"""Two live log sources for a run's detail page (docs/IMPLEMENTATION_PHASES.md
Phase 6, item 4): the harness container's own stdout, written locally by
runner.py, and the vLLM serve job's log on the cluster, reached through
`ClusterRuntime.job_logs(handle, follow=True)`
(docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 1) -- the same port the
endpoint lifecycle's readiness poll uses.

Each source runs as a background producer task feeding an asyncio.Queue,
consumed by `stream_log_events` and formatted as SSE wire text. The
queue is what lets the consumer send a keepalive comment on a timeout
without ever cancelling the producer's own in-flight read -- cancelling
a suspended async generator's `__anext__()` closes it for good (Python
does not allow resuming a generator past a thrown CancelledError), so
periodic keepalives have to live on a separate wait, not wrapped around
the producer itself.

Both producers stop themselves once the run reaches a terminal status,
so an abandoned browser tab (Trap T3) never leaves a serve job's
`tail -f` running against the login node forever; `_close_log_stream`
cancels the producer task and waits for its own cleanup -- closing the
SSH channel, for the endpoint source -- to finish before the SSE
response actually closes.

Every DB read below opens its own short-lived AsyncSessionLocal() rather
than reusing the request's session: a StreamingResponse's body is
consumed well after its router function returns, so holding onto a
`Depends(get_db)` session across the whole stream is not a session this
module can rely on staying open (or even valid) that long.
"""

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal

from app.db import AsyncSessionLocal
from app.services.cluster import get_cluster_runtime
from app.services.cluster.ports import JobHandle
from app.services.endpoints import queries as endpoints_queries
from app.services.harness import runner as harness_runner
from app.services.runs import queries as runs_queries

logger = logging.getLogger(__name__)

LogSource = Literal["harness", "endpoint"]

# Mirrors worker._TERMINAL_STATUSES -- kept as this module's own copy
# rather than importing that module-private constant, the same "each
# module owns its own status-set constant" pattern queries.py's
# _ACTIVE_STATUSES already follows.
_TERMINAL_STATUSES = ("done", "failed", "cancelled")

# How often the harness-log tail re-reads the file and re-checks run
# status, and how often the endpoint-log tail re-checks status between
# lines -- generous enough not to spam Postgres or the filesystem, short
# enough that "stop streaming" feels immediate once a run finishes.
_POLL_INTERVAL_SECONDS = 2

# SSE needs *some* traffic within common proxy/browser idle timeouts, or
# a silent connection looks dead and gets recycled -- a comment line is
# invisible to EventSource's own `message` event but keeps the stream
# alive.
_KEEPALIVE_INTERVAL_SECONDS = 20

# Enough to orient on load (a screenful of context) without replaying a
# whole run's history through one HTTP response.
_TAIL_LINES = 200


@dataclass
class LogStream:
    """A background producer task plus the queue it feeds -- the one
    shape both log sources return, so stream_log_events only has to get
    one consumption loop right instead of two.
    """

    queue: asyncio.Queue[str | None]
    producer: asyncio.Task[None]


async def stream_log_events(source: LogSource, eval_run_id: int) -> AsyncIterator[str]:
    """The whole SSE lifecycle for one subscriber: open the source's
    background producer, format its lines as SSE wire text with
    keepalives, and guarantee the producer is cancelled and its cleanup
    awaited once this generator itself closes -- whether that is the
    client disconnecting (T3) or the producer reaching its own natural
    end.
    """
    stream = _open_log_stream(source, eval_run_id)
    try:
        async for chunk in _consume_log_stream(stream):
            yield chunk
    finally:
        await _close_log_stream(stream)


def _open_log_stream(source: LogSource, eval_run_id: int) -> LogStream:
    queue: asyncio.Queue[str | None] = asyncio.Queue()
    producer_coroutine = (
        _produce_harness_log(eval_run_id, queue)
        if source == "harness"
        else _produce_endpoint_log(eval_run_id, queue)
    )
    return LogStream(queue=queue, producer=asyncio.create_task(producer_coroutine))


async def _consume_log_stream(stream: LogStream) -> AsyncIterator[str]:
    """SSE wire text from the producer's queue, with a keepalive comment
    whenever nothing real has arrived for a while. Ends as soon as the
    producer puts its closing `None`. Waiting on `queue.get()` is always
    safe to time out and retry -- unlike cancelling an in-flight read,
    this never closes anything (see module docstring).
    """
    while True:
        try:
            line = await asyncio.wait_for(stream.queue.get(), timeout=_KEEPALIVE_INTERVAL_SECONDS)
        except TimeoutError:
            yield ": keepalive\n\n"
            continue
        if line is None:
            return
        yield f"data: {line}\n\n"


async def _close_log_stream(stream: LogStream) -> None:
    """Cancels the producer and waits for its own cleanup -- closing the
    SSH channel, for the endpoint source -- to finish before returning,
    so the SSE response never closes ahead of that cleanup (T3).
    """
    stream.producer.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await stream.producer


async def _get_run_status(eval_run_id: int) -> str | None:
    async with AsyncSessionLocal() as db:
        eval_run = await runs_queries.get_run(db, eval_run_id)
        return eval_run.status if eval_run is not None else None


async def _get_endpoint_slurm_job_id(eval_run_id: int) -> int | None:
    """None if the run has no endpoint yet (still queued, or waiting on
    a cold start) or its endpoint was never assigned a SLURM job id --
    either way, there is no serve-job log to tail yet.
    """
    async with AsyncSessionLocal() as db:
        eval_run = await runs_queries.get_run(db, eval_run_id)
        if eval_run is None or eval_run.endpoint_id is None:
            return None
        endpoint = await endpoints_queries.get_endpoint(db, eval_run.endpoint_id)
        return endpoint.slurm_job_id if endpoint is not None else None


async def _produce_harness_log(eval_run_id: int, queue: asyncio.Queue[str | None]) -> None:
    """Tails harness_stdout.log, the file runner.py writes chunk by
    chunk as the harness container's own stdout arrives. Waits rather
    than erroring if the file doesn't exist yet -- during the ~350s cold
    start it genuinely doesn't, since run_harness only creates it once
    an endpoint is ready.

    Reads with plain synchronous file I/O, the same choice runner.py
    itself already makes for this same file -- v1 has no async file
    library dependency, and these reads are small and local. A line
    still being written when a poll lands can be forwarded as a partial
    line, completed on the next poll; harmless for a debug log view, and
    the same trade-off runner.py's own chunked (not line-by-line) read
    already accepts for the same file.
    """
    log_path = harness_runner.run_directory(eval_run_id) / "harness_stdout.log"
    position = 0
    try:
        while True:
            if log_path.exists():
                with log_path.open("r", encoding="utf-8", errors="replace") as log_file:
                    log_file.seek(position)
                    new_text = log_file.read()
                    position = log_file.tell()
                for line in new_text.splitlines():
                    await queue.put(line)

            status = await _get_run_status(eval_run_id)
            if status is None or status in _TERMINAL_STATUSES:
                return
            await asyncio.sleep(_POLL_INTERVAL_SECONDS)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("harness log tail failed for run %d", eval_run_id)
    finally:
        await queue.put(None)


async def _wait_for_endpoint(eval_run_id: int) -> int | None:
    """Polls until the run has an endpoint with a SLURM job id, or the
    run reaches a terminal status first -- a run cancelled while still
    waiting on a cold start (Phase 5's known gap) never gets one.
    """
    while True:
        slurm_job_id = await _get_endpoint_slurm_job_id(eval_run_id)
        if slurm_job_id is not None:
            return slurm_job_id
        status = await _get_run_status(eval_run_id)
        if status is None or status in _TERMINAL_STATUSES:
            return None
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)


async def _produce_endpoint_log(eval_run_id: int, queue: asyncio.Queue[str | None]) -> None:
    """Waits for this run's endpoint to have a SLURM job id, tails its
    serve-job log over SSH, and stops as soon as either the tail channel
    ends on its own or this run reaches a terminal status. The second
    case matters on its own: a shared endpoint (Trap T1) can outlive
    this one run, and a subscriber watching this run's log should not be
    left tailing a server it no longer has anything to do with.
    """
    try:
        slurm_job_id = await _wait_for_endpoint(eval_run_id)
        if slurm_job_id is None:
            return

        runtime = get_cluster_runtime()
        handle = JobHandle(job_id=slurm_job_id)
        initial_text = await runtime.job_logs(handle, follow=False)
        assert isinstance(initial_text, str)  # follow=False always returns text, never a stream
        for line in initial_text.splitlines()[-_TAIL_LINES:]:
            await queue.put(line)

        tail_task = asyncio.create_task(_pump_ssh_tail(handle, queue))
        try:
            while not tail_task.done():
                status = await _get_run_status(eval_run_id)
                if status is None or status in _TERMINAL_STATUSES:
                    return
                # Waits on the tail task too (not just a bare sleep) so
                # a channel that ends on its own is noticed immediately
                # rather than up to _POLL_INTERVAL_SECONDS late. Does
                # not cancel it on timeout -- asyncio.wait never touches
                # a pending task, unlike wait_for.
                await asyncio.wait([tail_task], timeout=_POLL_INTERVAL_SECONDS)
        finally:
            tail_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await tail_task
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("endpoint log tail failed for run %d", eval_run_id)
    finally:
        await queue.put(None)


async def _pump_ssh_tail(handle: JobHandle, queue: asyncio.Queue[str | None]) -> None:
    """Forwards every line from the cluster's tail -f channel into the
    queue for as long as that channel stays open. Cancelling this task
    (see _produce_endpoint_log) unwinds through connector._follow's own
    finally block, which is what actually closes the SSH channel --
    without that, an abandoned subscriber would leak a `tail -f` process
    on the login node (Trap T3's sibling problem).
    """
    lines = await get_cluster_runtime().job_logs(handle, follow=True)
    assert not isinstance(lines, str)  # follow=True always returns an iterator, never text
    async for line in lines:
        await queue.put(line.rstrip("\n"))
