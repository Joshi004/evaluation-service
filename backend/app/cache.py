"""Redis client factory.

Redis holds only ephemeral state — pub/sub for live updates, locks,
rate limiting (EVAL_SERVICE_PLAN.md, Section 16). If it's lost, nothing
durable is lost; Postgres is the source of truth.
"""

from redis.asyncio import Redis

from app.config import get_settings

settings = get_settings()

redis_client: Redis = Redis.from_url(settings.redis_url, decode_responses=True)


async def get_redis() -> Redis:
    """FastAPI dependency that returns the shared Redis client."""
    return redis_client
