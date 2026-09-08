"""Alembic environment.

sqlalchemy.url is intentionally absent from alembic.ini — the connection
string comes from app.config.Settings (the DATABASE_URL env var), the same
place the running app reads it from, so migrations and app can never
silently point at different databases.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context
from app.config import get_settings

# Importing from app.models (rather than app.models.base) pulls in every
# table module through its __init__.py re-export, which is what makes
# autogenerate see them on Base.metadata below.
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

DATABASE_URL = get_settings().database_url


def run_migrations_offline() -> None:
    """Emit migration SQL without a live DB connection."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live DB, using an async engine."""
    connectable = create_async_engine(DATABASE_URL, poolclass=pool.NullPool)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
