"""Response shape for GET /api/v1/leaderboard.

One row per (checkpoint, comparison_hash) pair -- pivoting that into
"checkpoints as rows, benchmarks as columns" is a frontend concern
(frontend/src/pages/LeaderboardPage.helper.ts), not this API's job.
"""

from datetime import datetime

from pydantic import BaseModel


class LeaderboardRow(BaseModel):
    checkpoint_id: int
    standard_id: int
    benchmark: str
    standard_hash: str
    label: str | None
    # What the leaderboard actually groups by (S-D5): two rows only
    # collapse to one if they share both the standard and the resolved
    # sampling profile, not just the standard.
    comparison_hash: str
    sampling_profile_label: str | None
    metric_name: str
    metric_value: float
    n_samples: int | None
    truncation_rate: float | None
    finished_at: datetime
