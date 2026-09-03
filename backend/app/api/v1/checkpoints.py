"""Checkpoint registry endpoints.

Will cover browsing S3, registering a checkpoint (with lineage: parent,
operation, notes), and staging status. See the `checkpoint` and
`artifact_location` tables in EVAL_SERVICE_PLAN.md, Section 10, and the
"S3 browser" page in Section 13.

Once routes exist, each should validate via its Pydantic schema and
delegate immediately to app.controllers.checkpoints — see
.cursor/rules/backend-layering.mdc. No routes yet.
"""

from fastapi import APIRouter

router = APIRouter()
