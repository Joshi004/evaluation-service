"""One row per attempt to evaluate one checkpoint under one standard.

standard_id, sampling_profile_id and serving_profile_id being enough on
their own (each row is immutable) removes most of what used to be here.
See docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5 for what changed
in Phase 3 and docs/DATA_MODEL_V1.md Section 3.6.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
    DateTime,
    Double,
    ForeignKey,
    Identity,
    Index,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class EvalRun(Base):
    __tablename__ = "eval_run"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'running', 'done', 'failed', 'cancelled')",
            name="eval_run_status_check",
        ),
        Index("eval_run_group", "run_group_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    run_group_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("run_group.id"))
    checkpoint_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("checkpoint.id"))
    standard_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("standard.id"))
    # The RESOLVED sampling profile -- the three-layer merge of the
    # checkpoint's default, the standard's sampling_overrides and the
    # submit's own overrides (S-D4), content-addressed like any other
    # profile. Not to be confused with checkpoint.default_sampling_profile_id,
    # which is only the first layer of that merge.
    sampling_profile_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sampling_profile.id"))
    # Recorded, not hashed into comparison_hash (S-D5): our one profile
    # doesn't quantize at serve time, so checkpoint identity already
    # covers the weights, and folding serving into the hash would split
    # the leaderboard population over a value that cannot move a score.
    # "Which runs used this profile" must still stay an indexed join
    # rather than an archaeology exercise, which is what this column is
    # for. Not to be confused with endpoint.serving_profile_id, a
    # different column on a different table (S-T12).
    serving_profile_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("serving_profile.id"))
    endpoint_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("endpoint.id"), default=None
    )

    status: Mapped[str] = mapped_column(Text)

    output_dir: Mapped[str | None] = mapped_column(Text, default=None)
    results_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=None)
    truncation_rate: Mapped[float | None] = mapped_column(Double, default=None)
    error: Mapped[str | None] = mapped_column(Text, default=None)

    # content_hash({"standard": standard.hash, "sampling": sampling_profile.hash})
    # (app/services/runs/comparison.py) -- what the leaderboard groups
    # by. Computed at submit time, not derived at read time (S-D23): a
    # mismatch between the stored hash and the referenced rows must show
    # up as a hash mismatch, not a wrong number wearing the right label.
    comparison_hash: Mapped[str] = mapped_column(CHAR(16))

    submitted_by: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


# Partial index needing DESC ordering -- defined as a standalone
# statement (not in __table_args__) so `.desc()` can reference the real
# mapped column. One of the three indexes backing the leaderboard query.
# Keyed on comparison_hash rather than standard_id (Phase 3): two runs
# only belong on the same leaderboard row if they share the resolved
# sampling profile too, not just the standard.
Index(
    "eval_run_board",
    EvalRun.checkpoint_id,
    EvalRun.comparison_hash,
    EvalRun.finished_at.desc(),
    postgresql_where=text("status = 'done'"),
)
