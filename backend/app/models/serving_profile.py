"""How to launch vLLM for a family of weights.

A table rather than columns on `checkpoint` because it's the endpoint
reuse key (Phase 3), and copying a flag list per checkpoint is how flag
lists drift apart. See docs/DATA_MODEL_V1.md Section 3.1.
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Identity, SmallInteger, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class ServingProfile(Base):
    __tablename__ = "serving_profile"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    # One argv token per element, e.g. {"--reasoning-parser", "qwen3"}, so
    # there is no shell quoting to get wrong.
    vllm_flags: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    gpus: Mapped[int] = mapped_column(SmallInteger, server_default="1")
    max_model_len: Mapped[int | None] = mapped_column(default=None)
    engine_version: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
