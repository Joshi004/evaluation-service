"""Immutable, content-addressed evaluation standard -- what test, and
how is it graded.

A row is created from its own content, hashed, and never updated or
deleted -- change anything and you get a new row with a new hash; if
that hash already exists, the existing row is reused. This is the idea
the whole v1 design turns on: it is what lets eval_run.standard_id be a
plain integer that can never change meaning. See
docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3 and docs/DATA_MODEL_V1.md
Section 3.3.

This table holds only the protocol -- what test, and how is it graded.
The eight sampling columns that would otherwise sit here live on
`sampling_profile` instead (app/models/sampling_profile.py), because
sampling legitimately depends on the checkpoint, not the benchmark
(docs/STANDARDS_AND_PROFILES_RESEARCH.md Section 5). What a benchmark's
own published definition mandates about sampling stays here as
`sampling_overrides`, merged in ahead of a user's submit-time overrides
(S-D4).
"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
    DateTime,
    Identity,
    Integer,
    SmallInteger,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class Standard(Base):
    __tablename__ = "standard"
    __table_args__ = (
        CheckConstraint(
            "think_handling IN ('strip', 'as_is')", name="standard_think_handling_check"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    # Identity, computed from the content -- fixed width so a 17th
    # character is impossible (Trap T2 of Phase 1).
    hash: Mapped[str] = mapped_column(CHAR(16), unique=True)
    # 'ifeval/v1'; NULL means an ad-hoc override minted at submit time
    # rather than a reviewed standard. UNIQUE (S-D3): editing a shipped
    # standard's field and reloading must fail loudly with an actionable
    # message, not silently insert a second row under the same label.
    label: Mapped[str | None] = mapped_column(Text, unique=True, default=None)
    benchmark: Mapped[str] = mapped_column(Text)
    framework: Mapped[str] = mapped_column(Text)
    framework_image: Mapped[str] = mapped_column(Text)
    task_name: Mapped[str] = mapped_column(Text)
    dataset_name: Mapped[str] = mapped_column(Text)
    # Nullable per decision D3: opencompass/ifeval exposes no pinnable
    # revision, so NULL says "we don't have one" rather than standing in
    # a fabricated pin. This corrects DATA_MODEL_V1.md's original
    # NOT NULL -- docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5 is
    # the authoritative version.
    dataset_revision: Mapped[str | None] = mapped_column(Text, default=None)
    split: Mapped[str | None] = mapped_column(Text, default=None)
    few_shot: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    prompt_template: Mapped[str] = mapped_column(Text, server_default=text("''"))
    extraction: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # A JSONB array of metric definitions, not a single object -- see
    # docs/DATA_MODEL_V1.md Section 3.3 for the shape.
    metrics: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    repeats: Mapped[int] = mapped_column(SmallInteger, server_default="1")
    sample_limit: Mapped[int | None] = mapped_column(default=None)

    # 'strip' | 'as_is' -- a scoring decision (how a think block is
    # handled when grading the completion), not a speaking decision, so
    # it stays here rather than moving to sampling_profile with
    # enable_thinking (S-D8).
    think_handling: Mapped[str] = mapped_column(Text)

    # What this benchmark's own published definition mandates about
    # sampling -- BFCL's temperature: 0.001, AIME25's max_tokens: 81920
    # -- merged ahead of a user's submit-time overrides but behind the
    # checkpoint's default sampling profile (S-D4). Never for what's
    # merely convenient; a standard's authors don't get to prefer a
    # temperature, only to require one the benchmark's definition sets.
    # Key set validated against SamplingProfileConfig's fields at load
    # time (S-D22) -- an unknown key here is a typo that would otherwise
    # silently produce a resolved profile with a phantom field.
    sampling_overrides: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )

    # Which samples run -- e.g. tau2's ['retail'] versus ['telecom'] is
    # the *only* field distinguishing those two standards (Phase 4,
    # RESEARCH §12). Hashed: it changes what was measured. Non-empty is
    # enforced at load time (S-T19) -- EvalScope silently falls back to
    # its own registered default for an empty/missing subset_list, which
    # is how a wrong number gets published looking normal.
    subsets: Mapped[list[str]] = mapped_column(ARRAY(Text))

    # Operational, not hashed (S-D7): neither field can change what a
    # benchmark measures, only how fast or how patiently it's run, so
    # editing either in the YAML updates this row in place instead of
    # minting a new standard (see the catalog loader's
    # sync_unhashed_columns).
    eval_batch_size: Mapped[int] = mapped_column(SmallInteger, server_default="32")
    # EvalScope's own field is the bare, overloaded `timeout` (S-D26) --
    # renamed on the way in because this system already has three other
    # timeouts (slurm_walltime_seconds, the SSH connector's 60s command
    # timeout) and the unqualified name is the one that invites editing
    # the wrong one.
    request_timeout_seconds: Mapped[int] = mapped_column(Integer, server_default="1800")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def as_hashable_dict(self) -> dict[str, Any]:
        """Every field that can change what a standard measures -- and
        nothing else. Feed this straight to `standard_hash()`
        (app/services/standards/hashing.py) to get this row's identity.

        Deliberately excludes `id`, `label`, and `created_at`: naming a
        standard or knowing when it was inserted doesn't change what it
        measures, so those must never affect the hash. See
        docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5 for the exact
        key set.

        Also excludes `eval_batch_size` and `request_timeout_seconds`
        (S-D7): neither can change what gets measured, only how fast or
        how patiently the measurement runs, so editing either updates
        this row in place instead of minting a new standard.
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
            "think_handling": self.think_handling,
            "sampling_overrides": self.sampling_overrides,
            "subsets": self.subsets,
        }
