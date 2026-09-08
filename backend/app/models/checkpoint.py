"""One row per set of weights we can evaluate.

Always already on the cluster's NFS in v1 -- no S3, no staging, no sync
and no verification step. See docs/DATA_MODEL_V1.md Section 3.2.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Index, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class Checkpoint(Base):
    __tablename__ = "checkpoint"
    __table_args__ = (Index("checkpoint_parent", "parent_checkpoint_id"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    path: Mapped[str] = mapped_column(Text)
    family: Mapped[str | None] = mapped_column(Text, default=None)
    # Nothing in the database prevents a cycle here -- this is the one
    # field in the schema that genuinely can't be backfilled later, so
    # check for cycles in the application at write time with a depth cap
    # (Trap T3). No write path exists yet this phase; this is just where
    # that check belongs once registration is built.
    parent_checkpoint_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("checkpoint.id"), default=None
    )
    serving_profile_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("serving_profile.id"))
    generation_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=None)
    registered_by: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
