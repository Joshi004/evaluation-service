"""Immutable, content-addressed evaluation recipe.

A row is created from its own content, hashed, and never updated or
deleted -- change anything and you get a new row with a new hash; if
that hash already exists, the existing row is reused. This is the idea
the whole v1 design turns on: it is what lets eval_run.recipe_id be a
plain integer that can never change meaning. See
docs/IMPLEMENTATION_PHASES.md Sections 0.5-0.6 and docs/DATA_MODEL_V1.md
Section 3.3.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    CHAR,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Double,
    Identity,
    Integer,
    SmallInteger,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class Recipe(Base):
    __tablename__ = "recipe"
    __table_args__ = (
        CheckConstraint("think_handling IN ('strip', 'as_is')", name="recipe_think_handling_check"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    # Identity, computed from the content -- fixed width so a 17th
    # character is impossible (Trap T2 of Phase 1).
    hash: Mapped[str] = mapped_column(CHAR(16), unique=True)
    # 'ifeval/v1-instruct'; NULL means an ad-hoc override minted at
    # submit time rather than a reviewed standard.
    label: Mapped[str | None] = mapped_column(Text, default=None)
    benchmark: Mapped[str] = mapped_column(Text)
    framework: Mapped[str] = mapped_column(Text)
    framework_image: Mapped[str] = mapped_column(Text)
    task_name: Mapped[str] = mapped_column(Text)
    dataset_name: Mapped[str] = mapped_column(Text)
    # Nullable per decision D3: opencompass/ifeval exposes no pinnable
    # revision, so NULL says "we don't have one" rather than standing in
    # a fabricated pin. This corrects DATA_MODEL_V1.md's original
    # NOT NULL -- docs/IMPLEMENTATION_PHASES.md Section 0.5 is the
    # authoritative version.
    dataset_revision: Mapped[str | None] = mapped_column(Text, default=None)
    split: Mapped[str | None] = mapped_column(Text, default=None)
    few_shot: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    prompt_template: Mapped[str] = mapped_column(Text, server_default=text("''"))
    extraction: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # A JSONB array of metric definitions, not a single object -- see
    # docs/DATA_MODEL_V1.md Section 3.3 for the shape.
    metrics: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    repeats: Mapped[int] = mapped_column(SmallInteger, server_default="1")
    sample_limit: Mapped[int | None] = mapped_column(Integer, default=None)

    # Every sampling column is NOT NULL deliberately -- a NULL here isn't
    # "unspecified", it's "a value the checkpoint's generation_config.json
    # will quietly supply underneath whatever we set". The schema refuses
    # to let us be vague about it.
    temperature: Mapped[float] = mapped_column(Double)
    top_p: Mapped[float] = mapped_column(Double)
    top_k: Mapped[int] = mapped_column(Integer)
    min_p: Mapped[float] = mapped_column(Double, server_default="0.0")
    presence_penalty: Mapped[float] = mapped_column(Double, server_default="0.0")
    repetition_penalty: Mapped[float] = mapped_column(Double, server_default="1.0")
    max_tokens: Mapped[int] = mapped_column(Integer)

    enable_thinking: Mapped[bool] = mapped_column(Boolean)
    think_handling: Mapped[str] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def as_hashable_dict(self) -> dict[str, Any]:
        """Every field that can change what a recipe measures -- and
        nothing else. Feed this straight to `recipe_hash()`
        (app/services/recipes/hashing.py) to get this row's identity.

        Deliberately excludes `id`, `label`, and `created_at`: naming a
        recipe or knowing when it was inserted doesn't change what it
        measures, so those must never affect the hash. See
        docs/IMPLEMENTATION_PHASES.md Section 0.6 for the exact key set.
        """
        return {
            "benchmark": self.benchmark,
            "framework": self.framework,
            "framework_image": self.framework_image,
            "task_name": self.task_name,
            "dataset_name": self.dataset_name,
            "dataset_revision": self.dataset_revision,
            "split": self.split,
            "few_shot": self.few_shot,
            "prompt_template": self.prompt_template,
            "extraction": self.extraction,
            "metrics": self.metrics,
            "repeats": self.repeats,
            "sample_limit": self.sample_limit,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "top_k": self.top_k,
            "min_p": self.min_p,
            "presence_penalty": self.presence_penalty,
            "repetition_penalty": self.repetition_penalty,
            "max_tokens": self.max_tokens,
            "enable_thinking": self.enable_thinking,
            "think_handling": self.think_handling,
        }
