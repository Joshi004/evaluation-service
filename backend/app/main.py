"""FastAPI application factory.

Assembles middleware and routers, and on startup (Phase 2, widened to
every catalog by docs/STANDARDS_AND_PROFILES_PHASES.md Phase 1) loads
every catalog directory's YAML files into its own table so a fresh
`docker compose up` has the seeded standards and serving profiles
without a manual reload call, and (Phase 5) fails any eval_run left
`queued`/`running` by an unclean stop. Per Phase 5's own "no reconciler
and no state machine" decision, a run's background worker task is
spawned directly from `POST /runs`
(app.services.runs.worker.spawn_run_worker), not from here -- this
lifespan only ever runs once, at startup, so it's the wrong place for
anything that has to happen per run. The reconciler loop
(app/services/reconciler) remains an unimplemented stub; if it's ever
built, it would start from the lifespan context below.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import get_settings
from app.db import AsyncSessionLocal
from app.services.catalog.loader import load_catalog
from app.services.runs.recovery import fail_interrupted_runs
from app.services.serving_profiles.repository import serving_profiles_repository
from app.services.standards.repository import standards_repository

# Uvicorn configures handlers for its own loggers (uvicorn.error,
# uvicorn.access) but never touches the root logger, so every
# `logging.getLogger(__name__)` call elsewhere in app/ -- standards
# loading, the cluster connector, the endpoint lifecycle -- was silently
# going nowhere without this. Per .cursor/rules/dev-workflow.mdc: log
# *why* something failed, which only works if the log is visible at all.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    async with AsyncSessionLocal() as db:
        # Before anything else: a run left queued/running by an unclean
        # stop has no worker left to finish it (Phase 5, item 3 -- v1 has
        # no reconciler to resume it), so it's marked failed rather than
        # left looking like it's still in progress forever.
        failed_run_count = await fail_interrupted_runs(db)
        if failed_run_count:
            logger.info(
                "marked %d run(s) failed on startup (status was queued/running)",
                failed_run_count,
            )

        catalog_dir = Path(settings.catalog_dir)
        for repository in (standards_repository, serving_profiles_repository):
            loaded = await load_catalog(db, catalog_dir, repository)
            logger.info(
                "loaded %d %s catalog entry(s) from %s",
                len(loaded),
                repository.name,
                catalog_dir / repository.directory_name,
            )
    yield
    # Shutdown: nothing to release yet.


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    return app


app = create_app()
