"""Aggregates all v1 routers under one prefix.

Mounted in app.main with the api_v1_prefix from Settings.
"""

from fastapi import APIRouter

from app.api.v1 import (
    benchmarks,
    checkpoints,
    cluster,
    endpoints,
    health,
    leaderboard,
    runs,
    standards,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(checkpoints.router, prefix="/checkpoints", tags=["checkpoints"])
api_router.include_router(benchmarks.router, prefix="/benchmarks", tags=["benchmarks"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(leaderboard.router, prefix="/leaderboard", tags=["leaderboard"])
api_router.include_router(endpoints.router, prefix="/endpoints", tags=["endpoints"])
api_router.include_router(cluster.router, prefix="/cluster", tags=["cluster"])
api_router.include_router(standards.router, prefix="/standards", tags=["standards"])
