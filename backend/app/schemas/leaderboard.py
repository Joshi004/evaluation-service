"""Response shape for GET /api/v1/leaderboard.

One row per (checkpoint, comparison_hash) pair -- pivoting that into
"checkpoints as rows, comparison hashes as columns" is a frontend
concern (frontend/src/pages/LeaderboardPage.helper.ts), not this API's
job.
"""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.diagnostics import ConfidenceInterval


class LeaderboardRow(BaseModel):
    checkpoint_id: int
    # The specific eval_run this row's metric came from -- what lets a
    # leaderboard cell link straight to its run page
    # (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 1).
    eval_run_id: int
    standard_id: int
    benchmark: str
    standard_hash: str
    label: str | None
    # What the leaderboard actually groups by (S-D5): two rows only
    # collapse to one if they share both the standard and the resolved
    # sampling profile, not just the standard.
    comparison_hash: str
    sampling_profile_label: str | None
    # label is null for an ad-hoc sampling profile -- the hash is what
    # still tells two such columns for the same benchmark apart once
    # the frontend pivot keys on comparison_hash (Phase 8).
    sampling_profile_hash: str
    # The serving profile this row's own eval_run actually ran against
    # (S-T12) -- not hashed into comparison_hash (S-D5: quantization-free
    # serving can't move a score), so two rows sharing a comparison_hash
    # could in principle carry different serving profiles; recorded here
    # so the UI can show it without a second round trip.
    serving_profile_label: str | None
    serving_profile_hash: str
    metric_name: str
    metric_value: float
    n_samples: int | None
    # A 95% Wilson interval over (metric_value, n_samples) -- the same
    # `wilson_interval` implementation the run detail page uses
    # (app/services/diagnostics/report_summary.py), so a leaderboard
    # cell and its own run page never disagree. `None` only when
    # `n_samples` is missing.
    confidence_interval: ConfidenceInterval | None
    truncation_rate: float | None
    finished_at: datetime
