"""sampling_profile table and checkpoint default

Revision ID: d6d3cbcb1fc3
Revises: 574fd0777d83
Create Date: 2026-09-10 11:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.engine import Connection

from alembic import op
from app.schemas.sampling_profiles import SamplingProfileConfig
from app.services.sampling_profiles.hashing import sampling_profile_hash

# revision identifiers, used by Alembic.
revision: str = "d6d3cbcb1fc3"
down_revision: str | Sequence[str] | None = "574fd0777d83"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Lightweight reflection of just the columns this migration touches --
# the standard pattern for a data migration in this repo (see
# 77be30708294_structured_content_addressed_serving_.py), so the
# statements below keep working even after a later migration adds or
# renames an unrelated column.
sampling_profile_table = sa.table(
    "sampling_profile",
    sa.column("id", sa.BigInteger()),
    sa.column("hash", sa.CHAR(length=16)),
    sa.column("label", sa.Text()),
    sa.column("temperature", sa.Double()),
    sa.column("top_p", sa.Double()),
    sa.column("top_k", sa.Integer()),
    sa.column("min_p", sa.Double()),
    sa.column("presence_penalty", sa.Double()),
    sa.column("repetition_penalty", sa.Double()),
    sa.column("max_tokens", sa.Integer()),
    sa.column("enable_thinking", sa.Boolean()),
    sa.column("seed", sa.Integer()),
)

checkpoint_table = sa.table(
    "checkpoint",
    sa.column("default_sampling_profile_id", sa.BigInteger()),
)


def upgrade() -> None:
    """Schema and seed data together, in the order S-T6 and S-T15 both
    require: create table -> seed rows -> add nullable FK column ->
    backfill -> NOT NULL. Any other order fails on a live database --
    the NOT NULL step would reject the FK column while it still holds
    NULL on every pre-existing checkpoint row.
    """
    op.create_table(
        "sampling_profile",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("hash", sa.CHAR(length=16), nullable=False),
        # NULL means an ad-hoc customisation minted at submit time
        # (Phase 3+) rather than a reviewed catalog entry -- mirrors
        # serving_profile.label exactly, UNIQUE from day one (S-D3).
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("temperature", sa.Double(), nullable=False),
        sa.Column("top_p", sa.Double(), nullable=False),
        sa.Column("top_k", sa.Integer(), nullable=False),
        sa.Column("min_p", sa.Double(), server_default="0.0", nullable=False),
        sa.Column("presence_penalty", sa.Double(), server_default="0.0", nullable=False),
        sa.Column("repetition_penalty", sa.Double(), server_default="1.0", nullable=False),
        sa.Column("max_tokens", sa.Integer(), nullable=False),
        sa.Column("enable_thinking", sa.Boolean(), nullable=False),
        # S-D6: hashed, not operational.
        sa.Column("seed", sa.Integer(), server_default="42", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hash"),
        sa.UniqueConstraint("label"),
    )

    conn = op.get_bind()
    greedy_id = _seed_sampling_profiles(conn)

    # Nullable first (S-T15): the NOT NULL FK below needs a row to
    # point at, which is exactly what the backfill just below provides.
    op.add_column(
        "checkpoint", sa.Column("default_sampling_profile_id", sa.BigInteger(), nullable=True)
    )
    op.create_foreign_key(
        "checkpoint_default_sampling_profile_id_fkey",
        "checkpoint",
        "sampling_profile",
        ["default_sampling_profile_id"],
        ["id"],
    )
    conn.execute(checkpoint_table.update().values(default_sampling_profile_id=greedy_id))
    op.alter_column(
        "checkpoint",
        "default_sampling_profile_id",
        existing_type=sa.BigInteger(),
        nullable=False,
    )


def _seed_sampling_profiles(conn: Connection) -> int:
    """Insert the sampling profiles from CATALOG Section 4.1, importing
    `SamplingProfileConfig` and `sampling_profile_hash` from `app` so
    this migration's hash and the catalog loader's hash cannot differ
    (S-T7) -- if they did, the first startup after this migration would
    find seven files, fail to match six of their hashes to a seeded
    row, and then find their labels already taken.

    Returns `greedy`'s id -- the migration's own backfill target
    (S-T6): `greedy` must exist before the FK below is added.

    Six rows, not seven: `catalog/sampling-profiles/` holds seven YAML
    files, but `qwen3_think` and `lfm2_5_think` hash identically --
    CATALOG gives them byte-identical values for every column, and with
    `enable_thinking`/`seed` pinned the same way on both, the two
    profiles are content-indistinguishable (the same mechanism S-D12
    uses to collapse the two IFEval standards). `hash` is UNIQUE, so
    only one row can exist for that content; it is seeded here under
    the label `qwen3_think`, the name Phase 3 (S-T8) and the shipped
    `ifeval-v1-think` standard both already depend on. See
    catalog/sampling-profiles/lfm2_5_think.yaml for the full
    explanation -- at startup the loader finds this row by hash for
    both files and inserts nothing further for either.
    """
    seeded_profiles: dict[str, SamplingProfileConfig] = {
        "greedy": SamplingProfileConfig(
            temperature=0.0,
            top_p=1.0,
            top_k=-1,
            min_p=0.0,
            presence_penalty=0.0,
            repetition_penalty=1.0,
            max_tokens=8192,
            enable_thinking=False,
            seed=42,
        ),
        "qwen3_think": SamplingProfileConfig(
            temperature=0.6,
            top_p=0.95,
            top_k=20,
            min_p=0.0,
            presence_penalty=0.0,
            repetition_penalty=1.0,
            max_tokens=16384,
            enable_thinking=True,
            seed=42,
        ),
        "qwen3_5_think": SamplingProfileConfig(
            temperature=1.0,
            top_p=0.95,
            top_k=20,
            min_p=0.0,
            # Load-bearing, not cosmetic (CATALOG Section 4.1's own
            # footnote) -- curbs a repetition loop the small Qwen3.5
            # models fall into; without it generation doesn't terminate.
            presence_penalty=1.5,
            repetition_penalty=1.0,
            max_tokens=32768,
            enable_thinking=True,
            seed=42,
        ),
        "lfm2_5_2_6b": SamplingProfileConfig(
            temperature=0.1,
            top_p=1.0,
            top_k=50,
            min_p=0.0,
            presence_penalty=0.0,
            repetition_penalty=1.1,
            max_tokens=16384,
            enable_thinking=False,
            seed=42,
        ),
        "minicpm5_instruct": SamplingProfileConfig(
            temperature=0.7,
            top_p=0.95,
            top_k=-1,
            min_p=0.0,
            presence_penalty=0.0,
            repetition_penalty=1.0,
            max_tokens=8192,
            enable_thinking=False,
            seed=42,
        ),
        "minicpm5_think": SamplingProfileConfig(
            temperature=0.9,
            top_p=0.95,
            top_k=-1,
            min_p=0.0,
            presence_penalty=0.0,
            repetition_penalty=1.0,
            max_tokens=16384,
            enable_thinking=True,
            seed=42,
        ),
    }

    greedy_id: int | None = None
    for label, config in seeded_profiles.items():
        hash_value = sampling_profile_hash(config.model_dump())
        row_id = conn.execute(
            sampling_profile_table.insert()
            .values(label=label, hash=hash_value, **config.model_dump())
            .returning(sampling_profile_table.c.id)
        ).scalar_one()
        if label == "greedy":
            greedy_id = row_id

    assert greedy_id is not None  # "greedy" is always a key in seeded_profiles
    return greedy_id


def downgrade() -> None:
    """Reverses upgrade(): drop the FK and column, then the table."""
    op.drop_constraint(
        "checkpoint_default_sampling_profile_id_fkey", "checkpoint", type_="foreignkey"
    )
    op.drop_column("checkpoint", "default_sampling_profile_id")
    op.drop_table("sampling_profile")
