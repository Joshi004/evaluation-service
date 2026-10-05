"""Proxies a manual chat request to a live endpoint's own vLLM server,
streaming the reply back as Server-Sent Events -- the "chat with the
model directly" playground, as distinct from `app.services.harness`,
which runs a full benchmark against the same kind of server.

vLLM's OpenAI-compatible server extends the standard chat-completions
request with fields like `top_k`, `repetition_penalty` and
`chat_template_kwargs` directly at the top level. `task_config.py`'s own
`generation_config.extra_body` is a detail of EvalScope's *client
library* (`extra_body` is the openai-python SDK's own pass-through
parameter, merged into the request body by that library before it ever
reaches the wire) -- this module posts raw JSON itself over `httpx`, so
`chat_template_kwargs` goes top-level here, not nested under an
`extra_body` key that would mean nothing to vLLM directly.

A model server with a reasoning parser configured (the `qwen3` serving
profile) splits thinking out of the reply at the server itself: each
streamed delta carries `reasoning_content` (or, on some vLLM versions,
`reasoning`) separately from `content`. Without a parser (`qwen3-plain`),
there is no separate field at all -- a `<think>...</think>` block simply
arrives as ordinary `content` text, and this module makes no attempt to
split it back out; the frontend shows it exactly as received.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.schemas.endpoints import (
    ChatContentEvent,
    ChatDoneEvent,
    ChatErrorEvent,
    ChatReasoningEvent,
    ChatRequest,
)
from app.services.cluster import get_cluster_runtime
from app.services.cluster.ports import JobHandle
from app.services.endpoints.queries import LiveEndpointForChat

logger = logging.getLogger(__name__)

# This module's own four event kinds -- one SSE frame is always exactly
# one of these, never a raw dict.
_ChatEvent = ChatReasoningEvent | ChatContentEvent | ChatDoneEvent | ChatErrorEvent

# Mirrors every catalog standard's own `request_timeout_seconds` (S-D7)
# -- generous enough for a 32,768-token thinking reply, the largest
# `max_tokens` any catalog sampling profile asks for
# (`qwen3_5_think.yaml`). `read`, not `pool`/`connect`/`write`: those
# three stay short because a hung connect or a stalled write is a real
# failure, not a slow model.
_REQUEST_TIMEOUT = httpx.Timeout(connect=10.0, write=10.0, pool=10.0, read=1800.0)


class EndpointNotReadyError(Exception):
    """The endpoint row exists but has no `url` yet -- still starting
    (or a cold start that failed in the instant before
    `lifecycle.start_or_reuse_endpoint` expired it). The router maps
    this to 409 rather than opening a tunnel to a server that may not
    be listening yet.
    """


class EndpointExpiredError(Exception):
    """The endpoint's walltime is already up. A row can stay visible to
    `GET /endpoints` for a few seconds after that until the next poll
    drops it -- the router maps this to 409 rather than opening a
    tunnel to a server SLURM may have already killed.
    """


async def stream_chat_events(
    target: LiveEndpointForChat, request: ChatRequest
) -> AsyncIterator[str]:
    """The whole proxy, as Server-Sent Events wire text. A client
    disconnect (Stop, or navigating away) cancels this generator the
    same way `app.services.runs.logs.stream_log_events` already relies
    on -- the `async with` blocks inside `_stream_chat_completion` then
    close vLLM's own response and connection as the cancellation
    unwinds through them, so Stop actually ends the generation on the
    server side, not just the browser's own display of it.
    """
    try:
        url = await _ensure_tunnel(target)
        async for event in _stream_chat_completion(url, target.served_model_name, request):
            yield event
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.exception(
            "chat stream failed for endpoint %d (%d message(s))",
            target.id,
            len(request.messages),
        )
        yield _sse_event(ChatErrorEvent(message=f"Could not complete the chat request: {exc}"))


async def _ensure_tunnel(target: LiveEndpointForChat) -> str:
    """Rebuilds the SSH tunnel if the backend's own `uvicorn --reload`
    restart dropped it since -- the same call the endpoint lifecycle's
    own readiness path uses (`ssh_slurm_runtime.open_serving_tunnel`),
    so the URL this returns is always `target.url`'s own value, never a
    drifted one.
    """
    assert target.slurm_job_id is not None, (
        "a live endpoint with a url always has a slurm_job_id (set before url, in that order)"
    )
    runtime = get_cluster_runtime()
    return await runtime.open_serving_tunnel(target.id, JobHandle(job_id=target.slurm_job_id))


def _build_request_body(served_model_name: str, request: ChatRequest) -> dict[str, Any]:
    """vLLM's own request shape -- see this module's own docstring for
    why `chat_template_kwargs` sits at the top level rather than nested
    under `extra_body`. Every `ChatSamplingSettings` field is sent
    explicitly, mirroring `task_config.build_task_config`'s own
    `generation_config`; `min_p` stays out for the same decision D4
    reason that function documents.
    """
    messages: list[dict[str, str]] = []
    if request.system_prompt:
        messages.append({"role": "system", "content": request.system_prompt})
    messages.extend(
        {"role": message.role, "content": message.content} for message in request.messages
    )

    settings = request.settings
    body: dict[str, Any] = {
        "model": served_model_name,
        "messages": messages,
        "temperature": settings.temperature,
        "top_p": settings.top_p,
        "top_k": settings.top_k,
        "presence_penalty": settings.presence_penalty,
        "repetition_penalty": settings.repetition_penalty,
        "max_tokens": settings.max_tokens,
        "chat_template_kwargs": {"enable_thinking": settings.enable_thinking},
        "stream": True,
        # Without this, the final chunk carries no `usage` object at
        # all -- ChatDoneEvent's own prompt_tokens/completion_tokens
        # would be None on every reply, not just the rare response that
        # omits one.
        "stream_options": {"include_usage": True},
    }
    if settings.seed is not None:
        body["seed"] = settings.seed
    return body


async def _stream_chat_completion(
    url: str, served_model_name: str, request: ChatRequest
) -> AsyncIterator[str]:
    """Posts the request and turns vLLM's own SSE stream into this
    module's four event kinds. A non-200 response (e.g. a prompt that
    no longer fits the context window) ends the stream with one
    `ChatErrorEvent` carrying vLLM's own message, never a raised
    exception -- the caller (`stream_chat_events`) only needs its own
    `except` block for a connection that fails outright.
    """
    body = _build_request_body(served_model_name, request)

    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
        async with client.stream("POST", f"{url}/chat/completions", json=body) as response:
            if response.status_code != 200:
                error_body = await response.aread()
                yield _sse_event(ChatErrorEvent(message=_describe_vllm_error(error_body)))
                return

            finish_reason: str | None = None
            prompt_tokens: int | None = None
            completion_tokens: int | None = None

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line.removeprefix("data: ")
                if payload == "[DONE]":
                    break
                chunk = json.loads(payload)

                choices = chunk.get("choices") or []
                if choices:
                    delta = choices[0].get("delta") or {}
                    # Both field names appear across vLLM versions for
                    # the same thing -- `reasoning_content` on newer
                    # releases, `reasoning` on some older ones.
                    reasoning_text = delta.get("reasoning_content") or delta.get("reasoning")
                    if reasoning_text:
                        yield _sse_event(ChatReasoningEvent(delta=reasoning_text))
                    content_text = delta.get("content")
                    if content_text:
                        yield _sse_event(ChatContentEvent(delta=content_text))
                    choice_finish_reason = choices[0].get("finish_reason")
                    if choice_finish_reason is not None:
                        finish_reason = choice_finish_reason

                # The trailing usage-only chunk (`stream_options.
                # include_usage`) carries an empty `choices` list, so
                # this read has to sit outside the `if choices:` guard
                # above rather than inside it.
                usage = chunk.get("usage")
                if usage is not None:
                    prompt_tokens = usage.get("prompt_tokens")
                    completion_tokens = usage.get("completion_tokens")

            yield _sse_event(
                ChatDoneEvent(
                    finish_reason=finish_reason,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                )
            )


def _describe_vllm_error(raw_body: bytes) -> str:
    """vLLM's own OpenAI-shaped error body is `{"error": {"message":
    ...}}` -- unwrapped here so the UI can show that sentence directly
    (e.g. "This model's maximum context length is ... tokens") instead
    of the raw JSON envelope around it. Falls back to the raw text for
    any response that isn't that shape.
    """
    try:
        parsed = json.loads(raw_body)
        message = parsed.get("error", {}).get("message")
        if isinstance(message, str) and message:
            return message
    except (json.JSONDecodeError, AttributeError):
        pass
    return raw_body.decode("utf-8", errors="replace") or "the model server returned an error"


def _sse_event(event: _ChatEvent) -> str:
    """One Server-Sent Events frame -- mirrors `app.services.runs.logs`'s
    own `data: ...\\n\\n` wire format, with a JSON payload instead of a
    plain log line so the frontend can tell the four event kinds apart
    by `type`.
    """
    return f"data: {event.model_dump_json()}\n\n"
