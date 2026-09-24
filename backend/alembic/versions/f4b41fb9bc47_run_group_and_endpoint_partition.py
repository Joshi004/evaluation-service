"""run group and endpoint partition

Revision ID: f4b41fb9bc47
Revises: 35bf03990a1b
Create Date: 2026-09-24 17:40:59.880884

Per-run SLURM partition selection: a submit now names the partition its
whole grid runs on (`run_group.partition`), and the endpoint that
actually ends up serving each checkpoint records where it landed
(`endpoint.partition`) -- which can differ from the run's own choice,
since a reused endpoint may already be running on a different
partition (endpoint reuse stays keyed on
`(checkpoint_id, serving_profile_id)` only, not partition).

Both columns are nullable with no server default and no data migration,
the same reasoning as `35bf03990a1b`'s `train_split` /
`few_shot_prompt_template`: neither column is part of any content hash,
so there is nothing to recompute, and `NULL` is the correct, honest
value for a row that predates this migration -- it ran against
whatever `Settings.slurm_partition` was at the time, which this
migration has no reliable way to reconstruct after the fact.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4b41fb9bc47"
down_revision: str | Sequence[str] | None = "35bf03990a1b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("run_group", sa.Column("partition", sa.Text(), nullable=True))
    op.add_column("endpoint", sa.Column("partition", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("endpoint", "partition")
    op.drop_column("run_group", "partition")
