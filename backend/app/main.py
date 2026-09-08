"""FastAPI application factory.

Assembles middleware and routers, and loads standards/*.yaml into the
`recipe` table on startup (Phase 2) so a fresh `docker compose up` has
the two IFEval recipes without a manual reload call. The reconciler loop
(app/services/reconciler) will likely start from the lifespan context
below once it exists.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import get_settings
from app.db import AsyncSessionLocal
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
