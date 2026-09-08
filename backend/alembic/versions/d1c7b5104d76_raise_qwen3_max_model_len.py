"""raise qwen3 max_model_len

Revision ID: d1c7b5104d76
Revises: a961c4064d9c
Create Date: 2026-09-08 17:44:40.738278

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d1c7b5104d76"
down_revision: str | Sequence[str] | None = "a961c4064d9c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Lightweight reflection of just the touched column -- the same pattern as
# a961c4064d9c_seed_qwen3_profile_and_checkpoint.py, so this keeps working
# even after a later migration adds or renames an unrelated column.
serving_profile_table = sa.table(
    "serving_profile",
    sa.column("name", sa.Text()),
    sa.column("max_model_len", sa.Integer()),
)


def upgrade() -> None:
    """8192 -> 32768.

    Phase 5's submit-time fit check (recipe.max_tokens plus a prompt
    allowance must fit serving_profile.max_model_len) cannot pass for
    either reviewed IFEval standard against the qwen3 profile as seeded:
    ifeval/v1-instruct sets max_tokens=8192 (zero room left for a prompt)
    and ifeval/v1-think sets max_tokens=16384 (over the window outright),
    against a profile whose max_model_len was 8192. That number was
    carried over from Appendix A's validated smoke script, which never
    claimed to be a real context-window decision -- the checkpoint's own
    generation_config (seeded in a961c4064d9c) already declares
    max_tokens=32768, and Qwen3-4B supports that context length. Raising
    the profile rather than loosening either recipe keeps the recipes,
    which are immutable and already reviewed, untouched.
    """
    conn = op.get_bind()
    conn.execute(
        serving_profile_table.update()
        .where(serving_profile_table.c.name == "qwen3")
        .values(max_model_len=32768)
    )


def downgrade() -> None:
    """Back to the original Appendix A value."""
    conn = op.get_bind()
    conn.execute(
        serving_profile_table.update()
        .where(serving_profile_table.c.name == "qwen3")
        .values(max_model_len=8192)
    )
