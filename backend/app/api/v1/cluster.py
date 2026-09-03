"""Cluster status endpoints.

Will cover reachability, queue depth, idle nodes, our jobs, and GPU-hours
this month. See the `cluster` table in EVAL_SERVICE_PLAN.md, Section 10,
and the "Cluster" page in Section 13.

Once routes exist, each should validate via its Pydantic schema and
delegate immediately to app.controllers.cluster — see
.cursor/rules/backend-layering.mdc. No routes yet.
"""

from fastapi import APIRouter

router = APIRouter()
