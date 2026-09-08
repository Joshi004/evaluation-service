"""Served-endpoint listing: every endpoint that hasn't expired yet.

The manual kill action belongs to a later phase -- this phase is
read-only.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import endpoints as endpoints_controller
from app.db import get_db
from app.schemas.endpoints import EndpointListItem

router = APIRouter()


@router.get("", response_model=list[EndpointListItem])
async def list_endpoints(db: AsyncSession = Depends(get_db)) -> list[EndpointListItem]:
    return await endpoints_controller.list_endpoints(db)
