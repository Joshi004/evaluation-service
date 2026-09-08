"""Loads standards/*.yaml into the `recipe` table.

See docs/IMPLEMENTATION_PHASES.md Phase 2: read the file, validate it
strictly, hash it, and insert only if that hash is new -- idempotent for
free, which is what lets `load_all` run at every startup and again on
every POST /api/v1/standards/reload without ever duplicating a row.
"""

import logging
from pathlib import Path

import yaml
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Recipe
from app.schemas.standards import StandardDocument
from app.services.recipes import queries as recipes_queries
from app.services.recipes.hashing import recipe_hash

logger = logging.getLogger(__name__)


async def load_standard(path: Path, db: AsyncSession) -> Recipe:
    """Load one YAML file. Same content as an existing row -> that row,
    untouched. New content -> a new row, committed.

    Validation happens before hashing, not after (Trap T3): an invalid
    file must fail loudly, with the filename and field in the message,
    rather than insert a bad row that -- being immutable -- would be
    permanent clutter. Hashing the *validated* document rather than the
    raw `yaml.safe_load()` dict is also what fixes Trap T2 for free: a
    field typed `float` coerces an int YAML value (`temperature: 0`) to
    `0.0`, so it hashes identically to `temperature: 0.0`.
    """
    raw_document = yaml.safe_load(path.read_text())
    document = StandardDocument.model_validate(raw_document)

    hashable = document.as_hashable_dict()
    hash_value = recipe_hash(hashable)

    existing = await recipes_queries.get_recipe_by_hash(db, hash_value)
    if existing:
        return existing
    return await recipes_queries.insert_recipe(db, hashable, hash_value, document.label)


async def load_all(standards_dir: Path, db: AsyncSession) -> list[Recipe]:
    """Scan `standards_dir` for every `*.yaml` file and load each one.

    One bad file must not take the rest down (Trap T4) -- at startup this
    would mean a single mid-edit file keeps the whole API from coming up.
    Each file gets its own try/except; a failure is logged with the
    filename and the loop moves on. The `rollback()` on failure matters
    specifically because Postgres aborts the whole transaction on error --
    without it, every file after the first bad one would fail too, for an
    unrelated reason.
    """
    loaded_recipes = []
    for path in sorted(standards_dir.glob("*.yaml")):
        try:
            loaded_recipes.append(await load_standard(path, db))
        except Exception:
            logger.exception("failed to load standard %s", path)
            await db.rollback()
    return loaded_recipes


def read_source_yaml(standards_dir: Path, label: str) -> str | None:
    """The raw text of the YAML file a labeled recipe was loaded from,
    keyed off `label` via the `/` -> `-` filename convention. Read fresh
    on every call rather than cached or stored: this is a low-traffic
    internal page and the files are small and local, so there's nothing
    to optimise yet.

    Returns None (logged) if the file has since been moved or deleted --
    the recipe row is immutable and outlives the file that created it.
    """
    path = standards_dir / f"{label.replace('/', '-')}.yaml"
    try:
        return path.read_text()
    except OSError:
        logger.warning("source YAML missing for label %s at %s", label, path)
        return None
