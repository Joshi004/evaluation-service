"""Aggregates all v1 routers under one prefix.

Mounted in app.main with the api_v1_prefix from Settings.

`cluster` and `standards` have no router this phase -- there is no
Cluster page (decision D5) and no cluster access at all yet, and
`standards` is re-added once Phase 2 gives it a real handler.
"""

from fastapi import APIRouter

from app.api.v1 import checkpoints, endpoints, health, leaderboard, recipes, runs

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(checkpoints.router, prefix="/checkpoints", tags=["checkpoints"])
api_router.include_router(recipes.router, prefix="/recipes", tags=["recipes"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(leaderboard.router, prefix="/leaderboard", tags=["leaderboard"])
api_router.include_router(endpoints.router, prefix="/endpoints", tags=["endpoints"])
