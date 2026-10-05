"""Served-endpoint resource: list every endpoint that hasn't expired
yet, start (or reuse) one for a checkpoint, kill one, and chat with
one.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import endpoints as endpoints_controller
from app.db import get_db
from app.schemas.endpoints import ChatRequest, CreateEndpointRequest, EndpointListItem
from app.services.cluster.ports import ReadinessTimeoutError, ServerDiedError
from app.services.endpoints.chat import EndpointExpiredError, EndpointNotReadyError

router = APIRouter()


@router.get("", response_model=list[EndpointListItem])
async def list_endpoints(db: AsyncSession = Depends(get_db)) -> list[EndpointListItem]:
    return await endpoints_controller.list_endpoints(db)


@router.post("", response_model=EndpointListItem)
async def start_endpoint(
    request: CreateEndpointRequest, db: AsyncSession = Depends(get_db)
) -> EndpointListItem:
    """Blocks until the endpoint is ready or has failed (confirmed
    synchronous design, D-blocking) -- a cold start is measured at
    ~350s, so this request can stay open for several minutes.
    """
    try:
        endpoint = await endpoints_controller.start_endpoint(db, request.checkpoint_id)
    except ServerDiedError as exc:
        # 502: the cluster gave a definite answer, and it's bad -- not a
        # gateway/network problem, but the closest standard code for
        # "the upstream server we tried to bring up failed outright".
        raise HTTPException(
            status_code=502,
            detail=f"vLLM server died after {exc.elapsed_seconds}s (exit code {exc.exit_code})",
        ) from exc
    except ReadinessTimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=f"vLLM server did not become ready within {exc.elapsed_seconds}s",
        ) from exc
    if endpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return endpoint


@router.delete("/{endpoint_id}", status_code=204)
async def kill_endpoint(endpoint_id: int, db: AsyncSession = Depends(get_db)) -> None:
    killed = await endpoints_controller.kill_endpoint(db, endpoint_id)
    if not killed:
        raise HTTPException(status_code=404, detail="Endpoint not found")


@router.post("/{endpoint_id}/chat")
async def chat_with_endpoint(
    endpoint_id: int, request: ChatRequest, db: AsyncSession = Depends(get_db)
) -> StreamingResponse:
    """Server-Sent Events -- mirrors `stream_run_logs`
    (`app/api/v1/runs.py`): the traffic is one-directional, and a
    thinking profile's reply can run for minutes, which a plain
    response risks a browser or proxy timing out on first. `db` here is
    only for the lookup inside `start_chat_stream` -- the stream itself
    never touches this request's session (same reasoning as
    `stream_run_logs`'s own module, `app/services/runs/logs.py`'s
    docstring).
    """
    try:
        events = await endpoints_controller.start_chat_stream(db, endpoint_id, request)
    except EndpointNotReadyError as exc:
        raise HTTPException(status_code=409, detail="This model server is still starting.") from exc
    except EndpointExpiredError as exc:
        raise HTTPException(
            status_code=409,
            detail="This model server has expired. Start a new one to continue chatting.",
        ) from exc
    if events is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
