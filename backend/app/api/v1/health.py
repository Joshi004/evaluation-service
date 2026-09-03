"""Health check — the one route in this skeleton with real logic.

Confirms the backend can actually reach Postgres and Redis, so
`docker compose up` is verifiable rather than just "the container started".
"""

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.db import get_db

router = APIRouter()


@router.get("/health")
async def health(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> dict:
    """Report whether the API, database and cache are all reachable."""
    dependencies = {"postgres": "unknown", "redis": "unknown"}
    overall = "ok"

    try:
        await db.execute(text("SELECT 1"))
        dependencies["postgres"] = "ok"
    except Exception as exc:  # noqa: BLE001 - report, don't crash the health check
        dependencies["postgres"] = f"error: {exc}"
        overall = "degraded"

    try:
        pong = await redis.ping()
        dependencies["redis"] = "ok" if pong else "error: no pong"
        if not pong:
            overall = "degraded"
    except Exception as exc:  # noqa: BLE001
        dependencies["redis"] = f"error: {exc}"
        overall = "degraded"

    return {"status": overall, "dependencies": dependencies}
