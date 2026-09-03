"""Leaderboard endpoints.

Will read only published, standard eval_run rows, grouped by profile_hash,
with confidence intervals. See EVAL_SERVICE_PLAN.md, Section 14.

Once routes exist, each should validate via its Pydantic schema and
delegate immediately to app.controllers.leaderboard — see
.cursor/rules/backend-layering.mdc. No routes yet.
"""

from fastapi import APIRouter

router = APIRouter()
