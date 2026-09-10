"""The eight v1 tables, re-exported so a single import makes every model
class visible on Base.metadata for Alembic autogenerate (see
alembic/env.py). `sampling_profile` and `standard` are the shape
docs/STANDARDS_AND_PROFILES_PHASES.md Phases 2-3 settled on.
"""

from app.models.base import Base
from app.models.checkpoint import Checkpoint
from app.models.endpoint import Endpoint
from app.models.eval_run import EvalRun
from app.models.metric import Metric
from app.models.run_group import RunGroup
from app.models.sampling_profile import SamplingProfile
from app.models.serving_profile import ServingProfile
from app.models.standard import Standard

__all__ = [
    "Base",
    "Checkpoint",
    "Endpoint",
    "EvalRun",
    "Metric",
    "RunGroup",
    "SamplingProfile",
    "ServingProfile",
    "Standard",
]
