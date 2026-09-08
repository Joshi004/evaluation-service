"""Leaderboard endpoint: one row per (checkpoint, recipe) pair.

Pivoting these flat rows into a checkpoints-by-benchmarks grid is a
frontend concern (frontend/src/pages/LeaderboardPage.helper.ts).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import leaderboard as leaderboard_controller
from app.db import get_db
from app.schemas.leaderboard import LeaderboardRow

router = APIRouter()


@router.get("", response_model=list[LeaderboardRow])
async def get_leaderboard(db: AsyncSession = Depends(get_db)) -> list[LeaderboardRow]:
    return await leaderboard_controller.get_leaderboard(db)
