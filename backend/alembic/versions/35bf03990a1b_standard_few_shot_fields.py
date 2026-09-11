"""standard few shot fields

Revision ID: 35bf03990a1b
Revises: 417409e871f5
Create Date: 2026-09-11 08:28:35.118461

Phase 5 (docs/STANDARDS_AND_PROFILES_PHASES.md): GSM8K and MMLU-Pro are
the first standards whose few-shot behaviour needs two fields the
schema didn't have a place for. `train_split` is the few-shot *source*
split (EvalScope's `BenchmarkMeta.train_split`, e.g. GSM8K's `train`,
MMLU-Pro's `validation`) -- distinct from `split` (`eval_split`, what's
actually scored). `few_shot_prompt_template` is the template
`DefaultDataAdapter.format_fewshot_template()` formats once
`few_shot > 0`, distinct from the existing `prompt_template`. Both are
nullable: every 0-shot standard has neither, and MMLU-Pro's own adapter
overrides `format_fewshot_template` and never reads the field at all.

Both columns join `Standard.as_hashable_dict()` (they can change what a
few-shot standard's prompt actually was), which means they change
`standard.hash` for the same reason `subsets` did in
417409e871f5_standard_subsets_and_operational_fields.py -- but unlike
that migration, this one does *not* recompute existing hashes. That
migration's recompute was correct because the meaning hadn't changed
(every row already implicitly ran EvalScope's own `default` subset).
Here, a `NULL` backfill on an existing `ifeval/v1` row is not obviously
"the same standard as before" in the same way, and Phase 5 already
requires wiping the database for an unrelated reason (S-D31: the
harness image tag itself changes to pin the new dataset set, which
would raise `CatalogConflictError` against every existing labelled row
on reload regardless of this migration). Recomputing hashes that are
about to be discarded is not worth the risk of a subtly wrong
recompute standing in for real data. On a fresh, empty database --
Phase 5's actual path -- this distinction is moot: there are no rows to
recompute either way.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "35bf03990a1b"
down_revision: str | Sequence[str] | None = "417409e871f5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add both columns, nullable with no server default -- an existing
    row backfills to NULL automatically, which is the correct value for
    a standard that predates both fields (see module docstring for why
    that is not recomputed into `standard.hash` here).
    """
    op.add_column("standard", sa.Column("train_split", sa.Text(), nullable=True))
    op.add_column("standard", sa.Column("few_shot_prompt_template", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("standard", "few_shot_prompt_template")
    op.drop_column("standard", "train_split")
