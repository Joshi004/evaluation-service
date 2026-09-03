"""Served-model endpoint management.

Will cover what's currently served on the cluster, on which node/GPUs,
idle time, and a manual kill button. See the `endpoint` table in
EVAL_SERVICE_PLAN.md, Section 10 — note `node` is a cache refreshed from
`squeue`, never trusted as-is — and the "Endpoints" page in Section 13.

No routes yet.
"""

from fastapi import APIRouter

router = APIRouter()
