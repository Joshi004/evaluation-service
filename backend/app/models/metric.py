"""One row per number a run produced.

Rows rather than columns, so adding a benchmark never needs a
migration. See docs/DATA_MODEL_V1.md Section 3.7.

`stderr` is deliberately not a column here -- it's derived at render
time from `value` and `n_samples` (binomial proportion), since storing
it would just be a second copy of the same information.
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Double,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Metric(Base):
    __tablename__ = "metric"
    __table_args__ = (
        UniqueConstraint("eval_run_id", "name"),
        Index("metric_primary", "eval_run_id", postgresql_where=text("is_primary")),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    eval_run_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("eval_run.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(Text)
    # Normalized: fractions are 0..1, so every benchmark is on one scale.
    value: Mapped[float] = mapped_column(Double)
    n_samples: Mapped[int | None] = mapped_column(Integer, default=None)
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default="false")
