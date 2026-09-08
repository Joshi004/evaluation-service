"""FastAPI application factory.

Assembles middleware and routers, and on startup (Phase 2) loads
standards/*.yaml into the `recipe` table so a fresh `docker compose up`
has the two IFEval recipes without a manual reload call, and (Phase 5)
fails any eval_run left `queued`/`running` by an unclean stop. Per Phase
5's own "no reconciler and no state machine" decision, a run's
background worker task is spawned directly from `POST /runs`
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
from app.services.runs.recovery import fail_interrupted_runs
from app.services.standards.loader import load_all

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

        loaded = await load_all(Path(settings.standards_dir), db)
        logger.info("loaded %d standard(s) from %s", len(loaded), settings.standards_dir)
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
