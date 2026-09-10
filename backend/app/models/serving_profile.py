"""Immutable, content-addressed serving profile -- how to launch an
engine (vLLM today) for a family of weights.

A row is created from its own content, hashed, and never updated or
deleted (R-D17): change anything and you get a new row with a new hash;
if that hash already exists, the existing row is reused. Same pattern as
`standard` (app/models/standard.py) -- see
docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 3. A table rather than
columns on `checkpoint`, because it's the endpoint reuse key and copying
a flag list per checkpoint is how flag lists drift apart -- see
docs/DATA_MODEL_V1.md Section 3.1.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import CHAR, BigInteger, DateTime, Double, Identity, SmallInteger, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class ServingProfile(Base):
    __tablename__ = "serving_profile"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    # Identity, computed from the content -- fixed width so a 17th
    # character is impossible, mirroring Standard.hash.
    hash: Mapped[str] = mapped_column(CHAR(16), unique=True)
    # 'qwen3'; NULL means an ad-hoc customisation minted at registration
    # time rather than a reviewed standard profile (R-D16).
    label: Mapped[str | None] = mapped_column(Text, unique=True, default=None)
    engine: Mapped[str] = mapped_column(Text)
    engine_version: Mapped[str] = mapped_column(Text)
    gpus: Mapped[int] = mapped_column(SmallInteger, server_default="1")
    tensor_parallel_size: Mapped[int] = mapped_column(SmallInteger, server_default="1")
    pipeline_parallel_size: Mapped[int] = mapped_column(SmallInteger, server_default="1")
    max_model_len: Mapped[int | None] = mapped_column(default=None)
    # 'qwen3'; NULL means no --reasoning-parser flag at all.
    reasoning_parser: Mapped[str | None] = mapped_column(Text, default=None)
    dtype: Mapped[str] = mapped_column(Text, server_default=text("'auto'"))
    # NULL means no --quantization flag at all.
    quantization: Mapped[str | None] = mapped_column(Text, default=None)
    gpu_memory_utilization: Mapped[float] = mapped_column(Double, server_default="0.9")
    # Escape hatch for uncommon or newly added engine settings (R-D6) --
    # keys are kebab-case CLI flag names without leading dashes, values
    # are str | int | float | bool. Never a second home for a field that
    # already has a column above; app.schemas.serving_profiles rejects
    # one at the API boundary.
    engine_options: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def as_hashable_dict(self) -> dict[str, Any]:
        """Every field that can change how this profile serves -- and
        nothing else. Feed this straight to `serving_profile_hash()`
        (app/services/serving_profiles/hashing.py) to get this row's
        identity.

        Deliberately excludes `id`, `label`, and `created_at`: naming a
        profile or knowing when it was inserted doesn't change how it
        serves, so those must never affect the hash. Mirrors
        `Standard.as_hashable_dict`'s docstring discipline exactly.
        """
        return {
            "engine": self.engine,
            "engine_version": self.engine_version,
            "gpus": self.gpus,
            "tensor_parallel_size": self.tensor_parallel_size,
            "pipeline_parallel_size": self.pipeline_parallel_size,
            "max_model_len": self.max_model_len,
            "reasoning_parser": self.reasoning_parser,
            "dtype": self.dtype,
            "quantization": self.quantization,
            "gpu_memory_utilization": self.gpu_memory_utilization,
            "engine_options": self.engine_options,
        }
