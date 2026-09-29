"""standard catalog metadata

Revision ID: 8a6c95a9413d
Revises: f4b41fb9bc47
Create Date: 2026-09-29 10:29:47.565424

docs/UI_REDESIGN_PLAN.md Phase 3 (D7, D11): three presentation-only
fields the Benchmarks UI needs -- `display_name`, `description`,
`category`. All three are nullable with no server default and no data
migration, the same reasoning as `f4b41fb9bc47`'s `partition` columns:
neither field is part of `Standard.as_hashable_dict()` (S-D7 -- naming
or describing a standard doesn't change what it measures), so nothing
here can affect `standard.hash` or any `comparison_hash` derived from
it, and `NULL` is the correct, honest value for a row that predates
this migration until the catalog loader's `sync_unhashed_columns`
backfills it from the YAML's own new `display_name` / `description` /
`category` keys on the next reload.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8a6c95a9413d"
down_revision: str | Sequence[str] | None = "f4b41fb9bc47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("standard", sa.Column("display_name", sa.Text(), nullable=True))
    op.add_column("standard", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("standard", sa.Column("category", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("standard", "category")
    op.drop_column("standard", "description")
    op.drop_column("standard", "display_name")
