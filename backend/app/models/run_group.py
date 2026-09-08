"""Ties several eval_run rows together from one submit.

A submit produces several runs -- a checkpoint against six benchmarks,
or three checkpoints against two -- and they need something tying them
together for one page, one progress view, one cancel. Every run belongs
to a group, including a single run: always creating one is less code
than branching on whether there is one. See docs/DATA_MODEL_V1.md
Section 3.4.
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Identity, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class RunGroup(Base):
    __tablename__ = "run_group"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    submitted_by: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
