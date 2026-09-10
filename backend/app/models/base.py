"""Shared declarative base for all ORM models.

The v1 schema is eight tables: serving_profile, sampling_profile,
checkpoint, standard, run_group, endpoint, eval_run, metric. See
docs/DATA_MODEL_V1.md for the reasoning behind the original seven and
docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5 for the exact DDL the
catalog split settled on. Each table is its own module under
app/models/, re-exported from app/models/__init__.py so alembic/env.py
can see them on Base.metadata.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
