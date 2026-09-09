"""structured content-addressed serving profile

Revision ID: 77be30708294
Revises: d1c7b5104d76
Create Date: 2026-09-09 08:47:42.038188

"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import Connection

from alembic import op
from app.schemas.serving_profiles import ServingProfileConfig
from app.services.serving_profiles.hashing import serving_profile_hash

# revision identifiers, used by Alembic.
revision: str = "77be30708294"
down_revision: str | Sequence[str] | None = "d1c7b5104d76"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Lightweight reflection of just the columns this migration touches --
# the standard Alembic pattern for a data migration in this repo (see
# a961c4064d9c_seed_qwen3_profile_and_checkpoint.py), so the statements
# below keep working even after a later migration adds or renames an
# unrelated column. Carries both the old (`vllm_flags`) and new column
# names because upgrade() and downgrade() each need one or the other at
# different points, never both at once.
serving_profile_table = sa.table(
    "serving_profile",
    sa.column("label", sa.Text()),
    sa.column("hash", sa.CHAR(length=16)),
    sa.column("engine", sa.Text()),
    sa.column("engine_version", sa.Text()),
    sa.column("gpus", sa.SmallInteger()),
    sa.column("tensor_parallel_size", sa.SmallInteger()),
    sa.column("pipeline_parallel_size", sa.SmallInteger()),
    sa.column("max_model_len", sa.Integer()),
    sa.column("reasoning_parser", sa.Text()),
    sa.column("dtype", sa.Text()),
    sa.column("quantization", sa.Text()),
    sa.column("gpu_memory_utilization", sa.Double()),
    sa.column("engine_options", postgresql.JSONB()),
    sa.column("vllm_flags", postgresql.ARRAY(sa.Text())),
)

# The one row a961c4064d9c seeded, as vllm_flags originally rendered it.
# Frozen here rather than derived from the new structured columns: this
# is what downgrade() must restore, exactly, regardless of what a later
# phase's rendering logic does -- see _backfill_seeded_profile's
# docstring for why the forward direction is equally literal.
_SEEDED_PROFILE_VLLM_FLAGS = [
    "--reasoning-parser",
    "qwen3",
    "--tensor-parallel-size",
    "1",
    "--gpu-memory-utilization",
    "0.85",
    "--generation-config",
    "vllm",
]


def upgrade() -> None:
    """Schema and data together: the pre-existing row's data cannot
    survive the schema change on its own, because there is no
    mechanical way to turn an arbitrary `vllm_flags` array back into
    structured columns in general (only this one known row's content is
    handled, in `_backfill_seeded_profile`).
    """
    # New columns, added nullable so the one pre-existing row survives
    # the ADD. `hash` and `engine` have no natural default and are
    # backfilled explicitly below, then made NOT NULL. The others either
    # take a constant server_default (Postgres applies it to existing
    # rows at ADD time) or are genuinely optional the way max_model_len
    # already was (reasoning_parser/quantization: NULL = "none").
    op.add_column("serving_profile", sa.Column("hash", sa.CHAR(length=16), nullable=True))
    op.add_column("serving_profile", sa.Column("engine", sa.Text(), nullable=True))
    op.add_column(
        "serving_profile",
        sa.Column("tensor_parallel_size", sa.SmallInteger(), server_default="1", nullable=False),
    )
    op.add_column(
        "serving_profile",
        sa.Column("pipeline_parallel_size", sa.SmallInteger(), server_default="1", nullable=False),
    )
    op.add_column("serving_profile", sa.Column("reasoning_parser", sa.Text(), nullable=True))
    op.add_column(
        "serving_profile",
        sa.Column("dtype", sa.Text(), server_default=sa.text("'auto'"), nullable=False),
    )
    op.add_column("serving_profile", sa.Column("quantization", sa.Text(), nullable=True))
    op.add_column(
        "serving_profile",
        sa.Column("gpu_memory_utilization", sa.Double(), server_default="0.9", nullable=False),
    )
    op.add_column(
        "serving_profile",
        sa.Column(
            "engine_options",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )

    # name -> label, per R-T9: autogenerate emits drop+add for a rename,
    # which would destroy the seeded row's value. Also drops NOT NULL --
    # NULL now means "ad-hoc customisation" (R-D16) -- while keeping the
    # UNIQUE constraint the column already had.
    op.alter_column(
        "serving_profile",
        "name",
        new_column_name="label",
        existing_type=sa.Text(),
        nullable=True,
    )
    op.execute(
        "ALTER TABLE serving_profile RENAME CONSTRAINT "
        "serving_profile_name_key TO serving_profile_label_key"
    )

    _backfill_seeded_profile(op.get_bind())

    # Applied after the backfill, not before -- these would reject the
    # backfill's own target row while it still held NULL.
    op.alter_column("serving_profile", "hash", existing_type=sa.CHAR(length=16), nullable=False)
    op.alter_column("serving_profile", "engine", existing_type=sa.Text(), nullable=False)
    op.create_unique_constraint("serving_profile_hash_key", "serving_profile", ["hash"])

    op.drop_column("serving_profile", "vllm_flags")


def _backfill_seeded_profile(conn: Connection) -> None:
    """Explicit literal values for the one row a961c4064d9c seeded, not
    a general `vllm_flags` parser (Phase 3 build item 1's own
    instruction) -- there is exactly one row, and a parser that only
    ever runs once is code that can only ever be wrong.

    `engine_version`, `gpus`, and `max_model_len` already hold the right
    values -- they existed before this migration -- and are left
    untouched; only the columns this migration just added are set.
    """
    seeded_config = ServingProfileConfig(
        engine="vllm",
        engine_version="0.19.0",
        gpus=1,
        tensor_parallel_size=1,
        pipeline_parallel_size=1,
        max_model_len=32768,
        reasoning_parser="qwen3",
        dtype="auto",
        quantization=None,
        gpu_memory_utilization=0.85,
        engine_options={},
    )
    # Imported from the application rather than reimplemented here, so
    # this migration's hash and the app's own hash cannot drift apart
    # (R-T10) -- if they ever did, resolve_serving_profile would insert
    # a duplicate of this row on the first customisation.
    hash_value = serving_profile_hash(seeded_config.model_dump())
    values: dict[str, Any] = {"hash": hash_value, **seeded_config.model_dump()}
    conn.execute(
        serving_profile_table.update()
        .where(serving_profile_table.c.label == "qwen3")
        .values(**values)
    )


def downgrade() -> None:
    """Reverses upgrade(): re-add `vllm_flags`, re-render the seeded
    row's original flags (frozen in `_SEEDED_PROFILE_VLLM_FLAGS` above,
    for the same reason the forward backfill is literal rather than
    derived), then drop every column this migration added.
    """
    op.add_column(
        "serving_profile",
        sa.Column(
            "vllm_flags",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
    )

    conn = op.get_bind()
    conn.execute(
        serving_profile_table.update()
        .where(serving_profile_table.c.label == "qwen3")
        .values(vllm_flags=_SEEDED_PROFILE_VLLM_FLAGS)
    )
    # A row minted by a customisation (label IS NULL) has no equivalent
    # in the pre-Phase-3 vllm_flags shape -- it keeps the '{}' the
    # column's own server_default just applied. label must be non-null
    # before the rename below regardless, so backfill it from the one
    # identifier every row already has.
    conn.execute(
        serving_profile_table.update()
        .where(serving_profile_table.c.label.is_(None))
        .values(label=serving_profile_table.c.hash)
    )

    op.alter_column(
        "serving_profile",
        "label",
        new_column_name="name",
        existing_type=sa.Text(),
        nullable=False,
    )
    op.execute(
        "ALTER TABLE serving_profile RENAME CONSTRAINT "
        "serving_profile_label_key TO serving_profile_name_key"
    )

    op.drop_constraint("serving_profile_hash_key", "serving_profile", type_="unique")
    op.drop_column("serving_profile", "engine_options")
    op.drop_column("serving_profile", "gpu_memory_utilization")
    op.drop_column("serving_profile", "quantization")
    op.drop_column("serving_profile", "dtype")
    op.drop_column("serving_profile", "reasoning_parser")
    op.drop_column("serving_profile", "pipeline_parallel_size")
    op.drop_column("serving_profile", "tensor_parallel_size")
    op.drop_column("serving_profile", "engine")
    op.drop_column("serving_profile", "hash")
