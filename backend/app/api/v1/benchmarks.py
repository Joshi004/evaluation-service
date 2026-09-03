"""Benchmark and recipe endpoints.

Will cover listing benchmarks and their active recipe (Layer 1 protocol +
Layer 2 defaults). See the `benchmark` and `recipe` tables in
EVAL_SERVICE_PLAN.md, Section 10, and Section 5 for what a recipe contains.

Once routes exist, each should validate via its Pydantic schema and
delegate immediately to app.controllers.benchmarks — see
.cursor/rules/backend-layering.mdc. No routes yet.
"""

from fastapi import APIRouter

router = APIRouter()
