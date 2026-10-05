"""Request/response shapes for /api/v1/endpoints."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EndpointListItem(BaseModel):
    id: int
    checkpoint_id: int
    checkpoint_name: str
    serving_profile_id: int
    # The GPU count this one live endpoint holds -- shown per row so a
    # human can total GPU usage across the page by eye (Phase 3, "the
    # GPUs a submit costs" -- for an endpoint, that's serving_profile.gpus,
    # not the number of eval_runs sharing it).
    gpus: int
    slurm_job_id: int | None
    # NULL only for an endpoint row that predates per-run SLURM
    # partition selection -- see endpoint.py's own column comment.
    partition: str | None
    url: str | None
    expires_at: datetime
    created_at: datetime


class CreateEndpointRequest(BaseModel):
    """POST body to start (or reuse) an endpoint. serving_profile_id is
    deliberately not here -- each checkpoint already has exactly one, so
    there's nothing for a client to choose between; the controller reads
    it from the checkpoint row.
    """

    checkpoint_id: int


# A manual chat message caps at this many characters -- generous enough
# for a full eval prompt pasted in to check it by hand, bounded so one
# request body can't grow unreasonably large. Not a token count: vLLM
# itself is what rejects a too-long *prompt* (the context-window check
# that already matters for a real eval run), this is only a request-size
# sanity bound.
_MAX_CHAT_MESSAGE_LENGTH = 16_000

ChatRole = Literal["user", "assistant"]


class ChatMessage(BaseModel):
    """One turn of the conversation sent to POST /endpoints/{id}/chat.
    There is no `system` role here -- a system prompt is
    `ChatRequest.system_prompt`, sent at most once per request, not a
    message a caller could repeat or reorder into the wrong place.
    """

    model_config = ConfigDict(extra="forbid")

    role: ChatRole
    content: Annotated[str, Field(min_length=1, max_length=_MAX_CHAT_MESSAGE_LENGTH)]


class ChatSamplingSettings(BaseModel):
    """Every field `app.services.harness.task_config`'s own
    `generation_config` sends for a real eval run, minus `min_p`
    (decision D4 -- EvalScope's `openai_api` path drops it silently, so
    a manual chat sending it would claim a control that doesn't exist
    there either). Matching that field set is what makes a manual chat
    a check against what an eval run could plausibly have sent, not an
    unrelated set of defaults.

    Every field below is required, not defaulted, for the same reason
    `task_config.py` sends each one explicitly: the server was started
    with `--generation-config vllm`
    (`app.services.serving_profiles.render`), so anything left out here
    falls back to vLLM's own default, not the model's.

    Bounds are a sanity ceiling against a malformed request, not a
    claim about what every model or sampling profile actually uses --
    `max_tokens`' own upper bound matches the largest catalog profile's
    value (`qwen3_5_think.yaml`).
    """

    model_config = ConfigDict(extra="forbid")

    temperature: float = Field(ge=0.0, le=2.0)
    top_p: float = Field(gt=0.0, le=1.0)
    # -1 is vLLM's own "disabled" value (every catalog profile that
    # doesn't set a real top_k uses it), not an error.
    top_k: int = Field(ge=-1, le=20_000)
    presence_penalty: float = Field(ge=-2.0, le=2.0)
    repetition_penalty: float = Field(gt=0.0, le=2.0)
    max_tokens: int = Field(ge=1, le=32_768)
    enable_thinking: bool
    # None (the default) means "let vLLM draw its own per-request seed"
    # -- Regenerate relies on that for a fresh sample each time. S-D6's
    # fixed seed=42 is an eval run's own reproducibility requirement,
    # not something a manual chat needs.
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)


class ChatRequest(BaseModel):
    """POST body for /api/v1/endpoints/{id}/chat. `extra='forbid'` so a
    typo'd field 422s instead of being silently ignored.
    """

    model_config = ConfigDict(extra="forbid")

    system_prompt: Annotated[str, Field(max_length=4_000)] | None = None
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    settings: ChatSamplingSettings

    @model_validator(mode="after")
    def _last_message_is_from_user(self) -> "ChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("the last message in a chat request must be from the user")
        return self


class ChatReasoningEvent(BaseModel):
    """One chunk of thinking text. A model server with a reasoning
    parser configured (the `qwen3` serving profile) splits this out of
    vLLM's own `delta.reasoning_content` field; see
    `app.services.endpoints.chat`'s own module docstring for how this
    differs from `ChatContentEvent` when no parser is configured.
    """

    type: Literal["reasoning"] = "reasoning"
    delta: str


class ChatContentEvent(BaseModel):
    """One chunk of the reply itself -- what becomes this message's own
    `content` if the conversation continues.
    """

    type: Literal["content"] = "content"
    delta: str


class ChatDoneEvent(BaseModel):
    """The stream's last event on a clean finish. `finish_reason` is
    vLLM's own value verbatim (`"stop"`, `"length"`, ...) -- the
    frontend turns `"length"` into "Cut off at max tokens", the same
    truncation vocabulary an eval run's own failure states already use.
    `prompt_tokens`/`completion_tokens` come from the final chunk's own
    `usage` object (requested via `stream_options.include_usage`); both
    are `None` if a response never carried one.
    """

    type: Literal["done"] = "done"
    finish_reason: str | None
    prompt_tokens: int | None
    completion_tokens: int | None


class ChatErrorEvent(BaseModel):
    """vLLM's own error message (e.g. a non-200 response because a
    prompt no longer fits the context window) or a cluster-side failure
    (the tunnel could not be rebuilt) -- either way, a message a human
    can read without an SSH session, the same reasoning
    `apiFetch`'s own `extractErrorDetail` already applies to a plain
    HTTP error response.
    """

    type: Literal["error"] = "error"
    message: str
