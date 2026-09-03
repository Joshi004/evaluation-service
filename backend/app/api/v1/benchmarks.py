"""Benchmark and recipe endpoints.

Will cover listing benchmarks and their active recipe (Layer 1 protocol +
Layer 2 defaults). See the `benchmark` and `recipe` tables in
EVAL_SERVICE_PLAN.md, Section 10, and Section 5 for what a recipe contains.

No routes yet.
"""

from fastapi import APIRouter

router = APIRouter()
