"""Async SQLAlchemy engine and session factory.

Postgres is the source of truth (EVAL_SERVICE_PLAN.md, Section 10). No
models are defined yet — see app/models/base.py.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, pool_pre_ping=True)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a database session per request."""
    async with AsyncSessionLocal() as session:
        yield session
