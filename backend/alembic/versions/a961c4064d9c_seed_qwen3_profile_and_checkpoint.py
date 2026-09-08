"""seed qwen3 profile and checkpoint

Revision ID: a961c4064d9c
Revises: f989cffd481b
Create Date: 2026-09-08 05:58:08.901098

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a961c4064d9c"
down_revision: str | Sequence[str] | None = "f989cffd481b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Lightweight reflections of just the columns this migration touches --
# the standard Alembic pattern for data migrations, so the insert below
# keeps working even after a later migration adds or renames an
# unrelated column. Types are spelled out explicitly (rather than left
# to infer) so asyncpg gets a real ARRAY/JSONB bind processor instead of
# guessing from the raw Python list/dict.
serving_profile_table = sa.table(
    "serving_profile",
    sa.column("id", sa.BigInteger()),
    sa.column("name", sa.Text()),
    sa.column("vllm_flags", postgresql.ARRAY(sa.Text())),
    sa.column("gpus", sa.SmallInteger()),
    sa.column("max_model_len", sa.Integer()),
    sa.column("engine_version", sa.Text()),
)

checkpoint_table = sa.table(
    "checkpoint",
    sa.column("name", sa.Text()),
    sa.column("path", sa.Text()),
    sa.column("family", sa.Text()),
    sa.column("serving_profile_id", sa.BigInteger()),
    sa.column("generation_config", postgresql.JSONB()),
    sa.column("registered_by", sa.Text()),
)


def upgrade() -> None:
    """Seed the qwen3 serving profile and its one checkpoint.

    Seeded here rather than left for a later registration flow so this
    phase's exit test has a real row to show: `alembic upgrade head` on
    an empty database should yield a system a human can look at.
    """
    conn = op.get_bind()

    profile_id = conn.execute(
        serving_profile_table.insert()
        .values(
            name="qwen3",
            # --generation-config vllm belongs in every profile: without
            # it, vLLM silently applies the checkpoint's own
            # generation_config.json underneath whatever we set here.
            # --reasoning-parser qwen3 is what makes think_handling:
            # strip mechanically true -- vLLM splits <think>...</think>
            # into a separate field before the harness ever sees the
            # response.
            vllm_flags=[
                "--reasoning-parser",
                "qwen3",
                "--tensor-parallel-size",
                "1",
                "--gpu-memory-utilization",
                "0.85",
                "--generation-config",
                "vllm",
            ],
            gpus=1,
            max_model_len=8192,
            engine_version="0.19.0",
        )
        .returning(serving_profile_table.c.id)
    ).scalar_one()

    conn.execute(
        checkpoint_table.insert().values(
            name="Qwen3-4B-allternary-ep03",
            path="/home/shared/agentic_slm/models/Qwen3-4B-allternary-ep03",
            family="Qwen3-4B",
            serving_profile_id=profile_id,
            # What this checkpoint's own generation_config.json actually
            # contains, read during validation. A later phase's
            # registration flow will read this from disk; seeding it now
            # lets the submit page's fit check be built without cluster
            # access.
            generation_config={
                "temperature": 0.6,
                "top_k": 20,
                "top_p": 0.95,
                "max_tokens": 32768,
            },
            registered_by="seed",
        )
    )


def downgrade() -> None:
    """Remove the seeded checkpoint and serving profile."""
    conn = op.get_bind()
    conn.execute(
        checkpoint_table.delete().where(checkpoint_table.c.name == "Qwen3-4B-allternary-ep03")
    )
    conn.execute(serving_profile_table.delete().where(serving_profile_table.c.name == "qwen3"))
