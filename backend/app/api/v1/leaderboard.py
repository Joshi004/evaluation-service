"""Leaderboard endpoints.

Will read only published, standard eval_run rows, grouped by profile_hash,
with confidence intervals. See EVAL_SERVICE_PLAN.md, Section 14.

No routes yet.
"""

from fastapi import APIRouter

router = APIRouter()
