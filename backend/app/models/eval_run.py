"""One row per attempt to evaluate one checkpoint under one recipe.

Thirteen columns, down from about forty in the original design --
recipe_id being enough on its own (the recipe row is immutable) removes
most of what used to be here. See docs/IMPLEMENTATION_PHASES.md Section
0.5 for what was cut and why it's safe, and docs/DATA_MODEL_V1.md
Section 3.6.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
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
    recipe_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("recipe.id"))
    endpoint_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("endpoint.id"), default=None
    )

    status: Mapped[str] = mapped_column(Text)

    output_dir: Mapped[str | None] = mapped_column(Text, default=None)
    results_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=None)
    truncation_rate: Mapped[float | None] = mapped_column(Double, default=None)
    error: Mapped[str | None] = mapped_column(Text, default=None)

    submitted_by: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


# Partial index needing DESC ordering -- defined as a standalone
# statement (not in __table_args__) so `.desc()` can reference the real
# mapped column. One of the three indexes backing the leaderboard query.
Index(
    "eval_run_board",
    EvalRun.checkpoint_id,
    EvalRun.recipe_id,
    EvalRun.finished_at.desc(),
    postgresql_where=text("status = 'done'"),
)
