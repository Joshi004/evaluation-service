"""checkpoint default profile, inferred metadata, availability

Revision ID: 574fd0777d83
Revises: 77be30708294
Create Date: 2026-09-09 09:17:34.772954

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "574fd0777d83"
down_revision: str | Sequence[str] | None = "77be30708294"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """The rename plus the new columns from
    docs/CHECKPOINT_REGISTRATION_PHASES.md Section 0.5. No data
    migration needed -- every new column is nullable or carries a
    server_default, so the seeded row survives every ADD untouched.
    """
    # serving_profile_id -> default_serving_profile_id, hand-written
    # rather than left to autogenerate (R-T9): autogenerate's drop+add
    # pair for a rename would drop the seeded row's FK value along with
    # the column. Stays NOT NULL -- every checkpoint has a recommended
    # way to be served.
    op.alter_column(
        "checkpoint",
        "serving_profile_id",
        new_column_name="default_serving_profile_id",
        existing_type=sa.BigInteger(),
        existing_nullable=False,
    )
    op.execute(
        "ALTER TABLE checkpoint RENAME CONSTRAINT "
        "checkpoint_serving_profile_id_fkey TO checkpoint_default_serving_profile_id_fkey"
    )

    # Inferred at registration, from config.json / generation_config.json
    # / the filesystem (Phase 5). All nullable with no default (R-D20):
    # NULL means "we could not read this," a real and common state for
    # an older or unusual checkpoint -- the seeded row predates
    # inspection entirely and stays null in every one of these until
    # someone validates it.
    op.add_column("checkpoint", sa.Column("model_type", sa.Text(), nullable=True))
    op.add_column("checkpoint", sa.Column("architecture", sa.Text(), nullable=True))
    op.add_column("checkpoint", sa.Column("base_model", sa.Text(), nullable=True))
    op.add_column("checkpoint", sa.Column("context_length", sa.Integer(), nullable=True))
    op.add_column("checkpoint", sa.Column("torch_dtype", sa.Text(), nullable=True))
    op.add_column("checkpoint", sa.Column("quantization", sa.Text(), nullable=True))
    op.add_column("checkpoint", sa.Column("weight_format", sa.Text(), nullable=True))
    op.add_column("checkpoint", sa.Column("shard_count", sa.SmallInteger(), nullable=True))
    # bigint, not integer -- a multi-shard checkpoint exceeds 2 GB
    # routinely (R-T14).
    op.add_column("checkpoint", sa.Column("size_bytes", sa.BigInteger(), nullable=True))
    op.add_column(
        "checkpoint",
        sa.Column("source_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # Availability, deliberately separate from registration (R-D1). The
    # server_default is applied before the CHECK constraint below
    # (R-T15) -- a CHECK on a table with existing rows fails unless
    # every existing row already satisfies it.
    op.add_column(
        "checkpoint",
        sa.Column(
            "availability_status",
            sa.Text(),
            server_default=sa.text("'unknown'"),
            nullable=False,
        ),
    )
    op.add_column(
        "checkpoint",
        sa.Column("availability_checked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("checkpoint", sa.Column("availability_detail", sa.Text(), nullable=True))
    op.create_check_constraint(
        "checkpoint_availability_status_check",
        "checkpoint",
        "availability_status IN ('unknown', 'available', 'unavailable', 'incomplete')",
    )


def downgrade() -> None:
    """Reverses upgrade(): drop the CHECK constraint and every column it
    added, then rename default_serving_profile_id back to
    serving_profile_id.
    """
    op.drop_constraint("checkpoint_availability_status_check", "checkpoint", type_="check")
    op.drop_column("checkpoint", "availability_detail")
    op.drop_column("checkpoint", "availability_checked_at")
    op.drop_column("checkpoint", "availability_status")
    op.drop_column("checkpoint", "source_config")
    op.drop_column("checkpoint", "size_bytes")
    op.drop_column("checkpoint", "shard_count")
    op.drop_column("checkpoint", "weight_format")
    op.drop_column("checkpoint", "quantization")
    op.drop_column("checkpoint", "torch_dtype")
    op.drop_column("checkpoint", "context_length")
    op.drop_column("checkpoint", "base_model")
    op.drop_column("checkpoint", "architecture")
    op.drop_column("checkpoint", "model_type")

    op.execute(
        "ALTER TABLE checkpoint RENAME CONSTRAINT "
        "checkpoint_default_serving_profile_id_fkey TO checkpoint_serving_profile_id_fkey"
    )
    op.alter_column(
        "checkpoint",
        "default_serving_profile_id",
        new_column_name="serving_profile_id",
        existing_type=sa.BigInteger(),
        existing_nullable=False,
    )
