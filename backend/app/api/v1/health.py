"""Health check — the one route in this skeleton with real logic.

Confirms the backend can actually reach Postgres, so `docker compose up`
is verifiable rather than just "the container started".
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db

router = APIRouter()


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict:
    """Report whether the API and database are reachable."""
    dependencies = {"postgres": "unknown"}
    overall = "ok"

    try:
        await db.execute(text("SELECT 1"))
        dependencies["postgres"] = "ok"
    except Exception as exc:  # noqa: BLE001 - report, don't crash the health check
        dependencies["postgres"] = f"error: {exc}"
        overall = "degraded"

    return {"status": overall, "dependencies": dependencies}
