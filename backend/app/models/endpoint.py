"""A running vLLM server.

A separate table because one server serves many runs -- a cold start
was measured at 350 seconds of H100 time, so reuse is worth real money.
See docs/DATA_MODEL_V1.md Section 3.5.
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class Endpoint(Base):
    __tablename__ = "endpoint"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    checkpoint_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("checkpoint.id"))
    serving_profile_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("serving_profile.id"))
    slurm_job_id: Mapped[int | None] = mapped_column(Integer, default=None)
    # The harness-facing address -- the local end of the SSH tunnel.
    # Never trust a stored node name: if a tunnel or HTTP call fails,
    # re-read the node from squeue and rebuild the forward before
    # concluding the server is dead.
    url: Mapped[str | None] = mapped_column(Text, default=None)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# The reuse key is (checkpoint_id, serving_profile_id), deliberately not
# sampling or max tokens -- those ride in the HTTP request body. Defined
# as a standalone statement (not in __table_args__) so `.desc()` can
# reference the real mapped column rather than a not-yet-instrumented
# class-body name.
Index(
    "endpoint_reuse",
    Endpoint.checkpoint_id,
    Endpoint.serving_profile_id,
    Endpoint.expires_at.desc(),
)
