"""Immutable, content-addressed sampling profile -- how to ask a model
to speak: temperature, top_p, top_k, min_p, penalties, max_tokens,
enable_thinking, seed, under a name like `greedy`.

A row is created from its own content, hashed, and never updated or
deleted: change anything and you get a new row with a new hash; if that
hash already exists, the existing row is reused. Mirrors
`serving_profile` (app/models/serving_profile.py) exactly -- see
docs/STANDARDS_AND_PROFILES_PHASES.md Phase 2, Section 0.5. A table
rather than columns on `recipe`/`standard`, because sampling depends on
the checkpoint, not the benchmark (RESEARCH §5) -- the same reuse-key
reasoning `serving_profile`'s own docstring gives.

**Known temporary state (Phase 2):** the eight sampling columns this
table adds also still exist on `recipe`, and nothing reads this table
for a run yet. Phase 3 removes the duplication.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import CHAR, BigInteger, Boolean, DateTime, Double, Identity, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class SamplingProfile(Base):
    __tablename__ = "sampling_profile"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    # Identity, computed from the content -- fixed width so a 17th
    # character is impossible, mirroring ServingProfile.hash.
    hash: Mapped[str] = mapped_column(CHAR(16), unique=True)
    # 'greedy'; NULL means an ad-hoc customisation minted at submit time
    # rather than a reviewed catalog profile.
    label: Mapped[str | None] = mapped_column(Text, unique=True, default=None)
    temperature: Mapped[float] = mapped_column(Double)
    top_p: Mapped[float] = mapped_column(Double)
    top_k: Mapped[int] = mapped_column(Integer)
    min_p: Mapped[float] = mapped_column(Double, server_default="0.0")
    presence_penalty: Mapped[float] = mapped_column(Double, server_default="0.0")
    repetition_penalty: Mapped[float] = mapped_column(Double, server_default="1.0")
    max_tokens: Mapped[int] = mapped_column(Integer)
    enable_thinking: Mapped[bool] = mapped_column(Boolean)
    # S-D6: a sampling control, not an execution one -- hashed so the
    # profile's promise is honest (run this again, get the same answer).
    seed: Mapped[int] = mapped_column(Integer, server_default="42")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def as_hashable_dict(self) -> dict[str, Any]:
        """Every field that can change how this profile asks a model to
        speak -- and nothing else. Feed this straight to
        `sampling_profile_hash()` (app/services/sampling_profiles/hashing.py)
        to get this row's identity.

        Deliberately excludes `id`, `label`, and `created_at`: naming a
        profile or knowing when it was inserted doesn't change how it
        samples, so those must never affect the hash. Mirrors
        `ServingProfile.as_hashable_dict`'s docstring discipline exactly.
        """
        return {
            "temperature": self.temperature,
            "top_p": self.top_p,
            "top_k": self.top_k,
            "min_p": self.min_p,
            "presence_penalty": self.presence_penalty,
            "repetition_penalty": self.repetition_penalty,
            "max_tokens": self.max_tokens,
            "enable_thinking": self.enable_thinking,
            "seed": self.seed,
        }
