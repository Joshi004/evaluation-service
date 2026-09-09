"""Serving-profile endpoints: list every profile, labelled standards and
ad-hoc customisations alike, for the registration wizard's profile
picker (Phase 5, item 5). No write routes here -- profiles are created
only as a side effect of registration resolving a customisation.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import serving_profiles as serving_profiles_controller
from app.db import get_db
from app.schemas.serving_profiles import ServingProfileSummary

router = APIRouter()


@router.get("", response_model=list[ServingProfileSummary])
async def list_serving_profiles(
    db: AsyncSession = Depends(get_db),
) -> list[ServingProfileSummary]:
    return await serving_profiles_controller.list_serving_profiles(db)
