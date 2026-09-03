"""Shared declarative base for all ORM models.

No tables defined yet. The intended schema — cluster, model, checkpoint,
artifact_location, model_profile, benchmark, recipe, eval_run, metric,
endpoint, job, publication — is specified in EVAL_SERVICE_PLAN.md, Section
10. Each will become a module here as it's implemented, and imported in
alembic/env.py so autogenerate can see it.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
