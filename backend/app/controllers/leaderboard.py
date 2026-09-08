"""Leaderboard controller -- validates + delegates, no DB access. See
.cursor/rules/backend-layering.mdc.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.leaderboard import LeaderboardRow
from app.services.leaderboard import queries as leaderboard_service


async def get_leaderboard(db: AsyncSession) -> list[LeaderboardRow]:
    return await leaderboard_service.get_leaderboard_rows(db)
