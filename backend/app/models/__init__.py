"""The seven v1 tables, re-exported so a single import makes every model
class visible on Base.metadata for Alembic autogenerate (see
alembic/env.py).
"""

from app.models.base import Base
from app.models.checkpoint import Checkpoint
from app.models.endpoint import Endpoint
from app.models.eval_run import EvalRun
from app.models.metric import Metric
from app.models.recipe import Recipe
from app.models.run_group import RunGroup
from app.models.serving_profile import ServingProfile

__all__ = [
    "Base",
    "Checkpoint",
    "Endpoint",
    "EvalRun",
    "Metric",
    "Recipe",
    "RunGroup",
    "ServingProfile",
]
