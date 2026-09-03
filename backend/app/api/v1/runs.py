"""Eval run submission and status endpoints.

Will cover submitting a run (checkpoint x benchmark x profile source),
tracking it through the state machine in EVAL_SERVICE_PLAN.md Section 10
("How a run moves"), and streaming logs. See the `eval_run` table there,
and the "Submit" / "Runs" pages in Section 13.

Once routes exist, each should validate via its Pydantic schema and
delegate immediately to app.controllers.runs — see
.cursor/rules/backend-layering.mdc. No routes yet.
"""

from fastapi import APIRouter

router = APIRouter()
