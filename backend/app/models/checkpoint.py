"""One row per set of weights we can evaluate.

Always already on the cluster's NFS in v1 -- no S3, no staging, no sync
and no verification step. See docs/DATA_MODEL_V1.md Section 3.2.

Availability is orthogonal to registration (R-D1): a row exists because
someone registered it, and it stays even if the weights behind it later
vanish -- the availability_* columns record that, they never delete the
row. See docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 4.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    SmallInteger,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class Checkpoint(Base):
    __tablename__ = "checkpoint"
    __table_args__ = (
        Index("checkpoint_parent", "parent_checkpoint_id"),
        CheckConstraint(
            "availability_status IN ('unknown', 'available', 'unavailable', 'incomplete')",
            name="checkpoint_availability_status_check",
        ),
    )

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
    # A default, not the only profile these weights can ever be served
    # under -- nothing in the schema forbids a run choosing another one.
    # Not to be confused with endpoint.serving_profile_id, a different
    # column on a different table (R-T13).
    default_serving_profile_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("serving_profile.id")
    )
    # A default, not the only profile a run against this checkpoint may
    # use -- nothing in the schema forbids a run choosing another one
    # (S-D9: an explicit sampling_profile_id at submit time overrides
    # it). Mirrors default_serving_profile_id's own comment exactly.
    default_sampling_profile_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("sampling_profile.id")
    )
    generation_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=None)
    registered_by: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Inferred at registration from config.json, generation_config.json,
    # and the filesystem. All nullable with no default (R-D20): NULL is
    # "we could not read this", and a default would make that
    # indistinguishable from a field we did read.
    model_type: Mapped[str | None] = mapped_column(Text, default=None)
    architecture: Mapped[str | None] = mapped_column(Text, default=None)
    # A hint shown to the user, never lineage -- parent_checkpoint_id is
    # the lineage FK and is set only by explicit choice (R-D5).
    base_model: Mapped[str | None] = mapped_column(Text, default=None)
    context_length: Mapped[int | None] = mapped_column(Integer, default=None)
    torch_dtype: Mapped[str | None] = mapped_column(Text, default=None)
    quantization: Mapped[str | None] = mapped_column(Text, default=None)
    weight_format: Mapped[str | None] = mapped_column(Text, default=None)
    shard_count: Mapped[int | None] = mapped_column(SmallInteger, default=None)
    # bigint, not integer -- a multi-shard checkpoint passes 2 GB
    # routinely (R-T14).
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, default=None)
    # Stored verbatim -- genuinely variable shape across model families,
    # which is the ground rule's condition for JSONB (R-D21). Keeping it
    # lets a later phase backfill a new inferred column without
    # re-reading the cluster.
    source_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=None)

    # Availability, deliberately separate from registration (R-D1). Four
    # states rather than a boolean (R-D19): 'incomplete' (config present,
    # shards missing) is a genuinely different situation from
    # 'unavailable' (nothing there), and 'unknown' is the honest state
    # for a row nobody has checked yet.
    availability_status: Mapped[str] = mapped_column(Text, server_default=text("'unknown'"))
    availability_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    availability_detail: Mapped[str | None] = mapped_column(Text, default=None)
