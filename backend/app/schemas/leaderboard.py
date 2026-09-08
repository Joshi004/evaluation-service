"""Response shape for GET /api/v1/leaderboard.

One row per (checkpoint, recipe) pair -- pivoting that into "checkpoints
as rows, benchmarks as columns" is a frontend concern
(frontend/src/pages/LeaderboardPage.helper.ts), not this API's job.
"""

from datetime import datetime

from pydantic import BaseModel


class LeaderboardRow(BaseModel):
    checkpoint_id: int
    recipe_id: int
    benchmark: str
    recipe_hash: str
    label: str | None
    metric_name: str
    metric_value: float
    n_samples: int | None
    truncation_rate: float | None
    finished_at: datetime
