"""Shared declarative base for all ORM models.

The v1 schema is seven tables: serving_profile, checkpoint, recipe,
run_group, endpoint, eval_run, metric. See docs/DATA_MODEL_V1.md for the
full reasoning behind each table and docs/IMPLEMENTATION_PHASES.md
Section 0.5 for the exact DDL being built. Each table is its own module
under app/models/, re-exported from app/models/__init__.py so
alembic/env.py can see them on Base.metadata.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
