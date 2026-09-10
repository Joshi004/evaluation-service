"""Aggregates all v1 routers under one prefix.

Mounted in app.main with the api_v1_prefix from Settings.

`cluster` has no router in v1 at all -- there is no Cluster page
(decision D5) and no cluster access until Phase 3. `standards` was
deleted in Phase 1 pending a real handler and is re-added here in
Phase 2; Phase 3 (docs/STANDARDS_AND_PROFILES_PHASES.md) folded its
previously separate list-every-hashed-row endpoint into it as
`?include_ad_hoc=true`, so there is no standalone router for that
resource any more. `run_groups` is a separate module from `runs`
(Phase 5) because it's a different resource path, not because it needs
different wiring.
"""

from fastapi import APIRouter

from app.api.v1 import (
    checkpoints,
    endpoints,
    health,
    leaderboard,
    run_groups,
    runs,
    sampling_profiles,
    serving_profiles,
    standards,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(checkpoints.router, prefix="/checkpoints", tags=["checkpoints"])
api_router.include_router(standards.router, prefix="/standards", tags=["standards"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(run_groups.router, prefix="/run-groups", tags=["run-groups"])
api_router.include_router(leaderboard.router, prefix="/leaderboard", tags=["leaderboard"])
api_router.include_router(endpoints.router, prefix="/endpoints", tags=["endpoints"])
api_router.include_router(
    serving_profiles.router, prefix="/serving-profiles", tags=["serving-profiles"]
)
api_router.include_router(
    sampling_profiles.router, prefix="/sampling-profiles", tags=["sampling-profiles"]
)
