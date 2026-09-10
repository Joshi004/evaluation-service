"""standard subsets and operational fields

Revision ID: 417409e871f5
Revises: 47563948d188
Create Date: 2026-09-11 00:45:00.000000

Phase 4 (docs/STANDARDS_AND_PROFILES_PHASES.md): three fields the
harness builder used to hardcode become real columns on `standard`.
`subsets` is hashed -- it changes which samples run, so it changes what
was measured (RESEARCH Section 12: it's the only thing distinguishing
`tau2_retail` from `tau2_telecom`). `eval_batch_size` and
`request_timeout_seconds` are recorded but not hashed (S-D7): neither
can change what gets measured, only how fast or how patiently it runs.

`subsets` joining the hash means every existing `standard` row's hash,
and every `eval_run.comparison_hash` derived from it, goes stale the
moment this migration runs (S-T17/S-T18) -- left alone, the next
catalog reload would find `ifeval/v1`'s label already claimed by a hash
that no longer matches the file, and report `conflicting` instead of
`loaded`. Both are recomputed in place below, importing the hash
functions from `app` rather than reimplementing them (the deleted
`77be30708294_structured_content_addressed_serving_.py` is the worked
example this follows) so this migration's hash and the running app's
can never drift apart. On a fresh database the recomputation touches
zero rows -- `standard` is populated by the startup catalog loader, not
by a migration -- but it still has to be correct against whatever a
developer's own dev database already holds, which is why it isn't
skipped just because a brand-new database doesn't need it.
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import Connection

from alembic import op
from app.services.runs.comparison import comparison_hash
from app.services.standards.hashing import standard_hash

# revision identifiers, used by Alembic.
revision: str = "417409e871f5"
down_revision: str | Sequence[str] | None = "47563948d188"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Lightweight reflections of just the columns the data migration
# touches -- the standard pattern for a data migration in this repo
# (see 47563948d188's own seed step). Every column carries its real
# type: migrations run over an async engine bound to asyncpg
# (backend/alembic/env.py), and an untyped sa.column("extraction")
# would come back as a raw string rather than a dict, silently hashing
# the wrong thing.
standard_table = sa.table(
    "standard",
    sa.column("id", sa.BigInteger()),
    sa.column("hash", sa.CHAR(length=16)),
    sa.column("benchmark", sa.Text()),
    sa.column("framework", sa.Text()),
    sa.column("framework_image", sa.Text()),
    sa.column("task_name", sa.Text()),
    sa.column("dataset_name", sa.Text()),
    sa.column("dataset_revision", sa.Text()),
    sa.column("split", sa.Text()),
    sa.column("few_shot", sa.SmallInteger()),
    sa.column("prompt_template", sa.Text()),
    sa.column("extraction", postgresql.JSONB()),
    sa.column("metrics", postgresql.JSONB()),
    sa.column("repeats", sa.SmallInteger()),
    sa.column("sample_limit", sa.Integer()),
    sa.column("think_handling", sa.Text()),
    sa.column("sampling_overrides", postgresql.JSONB()),
    sa.column("subsets", postgresql.ARRAY(sa.Text())),
)

sampling_profile_table = sa.table(
    "sampling_profile",
    sa.column("id", sa.BigInteger()),
    sa.column("hash", sa.CHAR(length=16)),
)

eval_run_table = sa.table(
    "eval_run",
    sa.column("id", sa.BigInteger()),
    sa.column("standard_id", sa.BigInteger()),
    sa.column("sampling_profile_id", sa.BigInteger()),
    sa.column("comparison_hash", sa.CHAR(length=16)),
)


def upgrade() -> None:
    """Add the three columns, then recompute every hash `subsets`
    joining `standard.hash` invalidates.
    """
    op.add_column(
        "standard",
        sa.Column(
            "subsets",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{default}'"),
            nullable=False,
        ),
    )
    # Future inserts must be explicit (S-T19: an empty/omitted subsets
    # list is a standard that says nothing) -- the server default above
    # exists only to backfill whatever rows are already in this
    # database.
    op.alter_column("standard", "subsets", server_default=None)

    op.add_column(
        "standard",
        sa.Column("eval_batch_size", sa.SmallInteger(), server_default="32", nullable=False),
    )
    op.add_column(
        "standard",
        sa.Column("request_timeout_seconds", sa.Integer(), server_default="1800", nullable=False),
    )

    conn = op.get_bind()
    new_standard_hash_by_id = _recompute_standard_hashes(conn, include_subsets=True)
    _recompute_comparison_hashes(conn, new_standard_hash_by_id)


def downgrade() -> None:
    """Recompute every hash back to its pre-Phase-4 value *before*
    dropping the columns `include_subsets=False` still needs to read.
    """
    conn = op.get_bind()
    new_standard_hash_by_id = _recompute_standard_hashes(conn, include_subsets=False)
    _recompute_comparison_hashes(conn, new_standard_hash_by_id)

    op.drop_column("standard", "request_timeout_seconds")
    op.drop_column("standard", "eval_batch_size")
    op.drop_column("standard", "subsets")


def _standard_hashable_dict(row: Any, *, include_subsets: bool) -> dict[str, Any]:
    """The exact key set `standard_hash` must see for one row of the
    plain SQL reflection above -- not the ORM, which a migration must
    never import (today's `Standard.as_hashable_dict()` would silently
    stop matching this function the moment a later phase changes it).
    `include_subsets=False` reproduces the pre-Phase-4 hash, for
    `downgrade()`; `True` is what `upgrade()` and the running app
    compute from this point on.
    """
    hashable: dict[str, Any] = {
        "benchmark": row.benchmark,
        "framework": row.framework,
        "framework_image": row.framework_image,
        "task_name": row.task_name,
        "dataset_name": row.dataset_name,
        "dataset_revision": row.dataset_revision,
        "split": row.split,
        "few_shot": row.few_shot,
        "prompt_template": row.prompt_template,
        "extraction": row.extraction,
        "metrics": row.metrics,
        "repeats": row.repeats,
        "sample_limit": row.sample_limit,
        "think_handling": row.think_handling,
        "sampling_overrides": row.sampling_overrides,
    }
    if include_subsets:
        hashable["subsets"] = list(row.subsets)
    return hashable


def _recompute_standard_hashes(conn: Connection, *, include_subsets: bool) -> dict[int, str]:
    """Recompute and write back every `standard` row's hash. Returns
    `{standard_id: new_hash}` so `_recompute_comparison_hashes` can join
    against it without a second read.
    """
    rows = conn.execute(sa.select(standard_table)).all()
    new_hash_by_id: dict[int, str] = {}
    for row in rows:
        new_hash = standard_hash(_standard_hashable_dict(row, include_subsets=include_subsets))
        new_hash_by_id[row.id] = new_hash
        conn.execute(
            standard_table.update().where(standard_table.c.id == row.id).values(hash=new_hash)
        )
    return new_hash_by_id


def _recompute_comparison_hashes(conn: Connection, new_standard_hash_by_id: dict[int, str]) -> None:
    """`eval_run.comparison_hash` is derived from `standard.hash` and
    `sampling_profile.hash` (app/services/runs/comparison.py) and
    stored, not recomputed at read time (S-D23) -- so a `standard.hash`
    change must be propagated here too, or a run's stored hash would
    silently point at a standard hash that no longer exists anywhere
    (S-T18). The measurement a run represents hasn't actually changed --
    every run already implicitly ran EvalScope's own `["default"]`
    subset, this migration only makes that explicit -- so recomputing
    rather than stranding old runs on a separate leaderboard grouping is
    correct.
    """
    sampling_hash_by_id = {
        row.id: row.hash for row in conn.execute(sa.select(sampling_profile_table)).all()
    }
    for run in conn.execute(sa.select(eval_run_table)).all():
        new_standard_hash = new_standard_hash_by_id.get(run.standard_id)
        sampling_hash = sampling_hash_by_id.get(run.sampling_profile_id)
        if new_standard_hash is None or sampling_hash is None:
            continue
        conn.execute(
            eval_run_table.update()
            .where(eval_run_table.c.id == run.id)
            .values(comparison_hash=comparison_hash(new_standard_hash, sampling_hash))
        )
