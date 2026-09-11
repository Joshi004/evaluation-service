"""The generic catalog loader -- one mechanism for every reviewed-YAML
catalog, parameterised by a `CatalogRepository` (S-D1, S-D17). Reads a
YAML file, validates it strictly against the repository's own document
model, hashes the *validated* document, and inserts only if that hash is
new -- idempotent for free, which is what lets `load_catalog` run at
every startup and again on every `POST /{resource}/reload` without ever
duplicating a row. Generalised from the standards-only
`app.services.standards.loader`, which this replaces
(docs/STANDARDS_AND_PROFILES_PHASES.md Phase 1).
"""

import logging
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.catalog import CatalogEntryStatus, CatalogStatus
from app.services.catalog.deletion import annotate_deletability
from app.services.catalog.paths import source_yaml_path
from app.services.catalog.ports import CatalogRepository, RowT
from app.services.content_hash import content_hash

logger = logging.getLogger(__name__)


class CatalogConflictError(Exception):
    """A YAML file's label already belongs to a row with a *different*
    hash -- S-D3's `UNIQUE` label made actionable. Raised by `_load_one`
    and caught by `load_catalog`'s per-file `try`/`except` like any other
    bad file: logged, and the loop moves on.
    """

    def __init__(self, *, label: str, filename: str, existing_hash: str, new_hash: str) -> None:
        self.label = label
        self.filename = filename
        self.existing_hash = existing_hash
        self.new_hash = new_hash
        super().__init__(
            f"{filename}: label {label!r} already belongs to a row with hash "
            f"{existing_hash!r}, but this file hashes to {new_hash!r} -- "
            + _conflict_resolution_hint()
        )


def _conflict_resolution_hint() -> str:
    """The one piece of advice a label conflict needs, in one place so
    the loader's exception message and the `catalog-status` `detail`
    text can't drift apart from each other.

    Phase 6 makes "delete the existing row" a real, callable action --
    but only once no file claims its label (S-D10's second guard is
    literal), and the very file causing this conflict is, by
    definition, sitting at that label's path right now. So deleting
    the old row needs that file gone or renamed first -- a git-level
    edit to catalog/, per S-D30, not something the API does.
    """
    return (
        "bump the version in the label to load this as a new row, or remove/rename this "
        "file (deletion is blocked while a file claims the label) and delete the existing "
        "row, then reload"
    )


async def load_catalog(
    db: AsyncSession, catalog_dir: Path, repository: CatalogRepository[RowT]
) -> list[RowT]:
    """Scan `catalog_dir / repository.directory_name` for every
    `*.yaml` file and load each one.

    One bad file must not take the rest down -- at startup this would
    mean a single mid-edit file keeps the whole API from coming up. Each
    file gets its own `try`/`except`; a failure is logged with the
    filename and the loop moves on. The `rollback()` on failure matters
    specifically because Postgres aborts the whole transaction on error
    -- without it, every file after the first bad one would fail too,
    for an unrelated reason (S-T5).
    """
    directory = catalog_dir / repository.directory_name
    loaded_rows: list[RowT] = []
    for path in sorted(directory.glob("*.yaml")):
        try:
            loaded_rows.append(await _load_one(db, path, repository))
        except Exception:
            logger.exception("failed to load %s catalog entry %s", repository.name, path)
            await db.rollback()
    return loaded_rows


async def _load_one(db: AsyncSession, path: Path, repository: CatalogRepository[RowT]) -> RowT:
    """Load one YAML file. Same content as an existing row -> that row,
    untouched. New content -> a new row, committed.

    Validation happens before hashing, not after: an invalid file must
    fail loudly, with the filename and field in the message, rather than
    insert a bad row that -- being immutable -- would be permanent
    clutter. Hashing the *validated* document rather than the raw
    `yaml.safe_load()` dict is also what makes a field typed `float`
    coerce an int YAML value (`temperature: 0`) to `0.0`, so it hashes
    identically to `temperature: 0.0` (S-T2).

    A hash *hit* is not necessarily a no-op: `sync_unhashed_columns`
    still runs, because an operational field (S-D7, e.g. standard's
    `eval_batch_size`) can change in the YAML without changing the
    content hash, and the file is that field's source of truth even
    though it doesn't participate in identity.
    """
    raw_document = yaml.safe_load(path.read_text())
    document = repository.document_model.model_validate(raw_document)

    hashable = document.as_hashable_dict()
    hash_value = content_hash(hashable)

    existing = await repository.get_by_hash(db, hash_value)
    if existing is not None:
        await repository.sync_unhashed_columns(db, existing, document.as_unhashed_dict())
        return existing

    # An explicit lookup, not a caught IntegrityError (S-T3): this gives
    # every catalog the same actionable CatalogConflictError, with both
    # hashes in it, instead of a bare IntegrityError whose message
    # depends on which table's UNIQUE constraint happened to fire.
    conflicting = await repository.get_by_label(db, document.label)
    if conflicting is not None:
        raise CatalogConflictError(
            label=document.label,
            filename=path.name,
            existing_hash=conflicting.hash,
            new_hash=hash_value,
        )

    config = hashable | document.as_unhashed_dict()
    return await repository.insert(db, config, hash_value, document.label)


async def catalog_status(
    db: AsyncSession, catalog_dir: Path, repository: CatalogRepository[RowT]
) -> CatalogStatus:
    """The dry run behind every `GET /{resource}/catalog-status`: the
    same read and validation as `load_catalog`, but no writes. One entry
    per YAML file, plus one per row that no file accounts for
    (`orphaned` or `ad_hoc`) -- so a single call describes the whole
    catalog.
    """
    directory = catalog_dir / repository.directory_name
    entries: list[CatalogEntryStatus] = []
    claimed_row_ids: set[int] = set()

    for path in sorted(directory.glob("*.yaml")):
        entry, claimed_row_id = await _status_for_file(db, path, repository)
        entries.append(entry)
        if claimed_row_id is not None:
            claimed_row_ids.add(claimed_row_id)

    for row in await repository.list_all(db):
        # A row this loop already matched to a file (loaded or
        # conflicting) is not also orphaned or ad-hoc -- it has a file.
        if row.id in claimed_row_ids:
            continue
        entries.append(_status_for_unclaimed_row(row))

    # Phase 6: fill in `deletable` (and fold any blocker into `detail`)
    # for every entry with a row_id, so this one call is also what
    # Phase 7's delete UI reads -- no second round trip per row.
    entries = await annotate_deletability(db, catalog_dir, repository, entries)

    return CatalogStatus(catalog=repository.name, entries=entries)


async def _status_for_file(
    db: AsyncSession, path: Path, repository: CatalogRepository[RowT]
) -> tuple[CatalogEntryStatus, int | None]:
    """One file's status line, plus the id of the row it claims (if
    any) so `catalog_status` can exclude that row from the orphaned/
    ad-hoc pass over `list_all`.
    """
    raw_document: Any = None
    try:
        raw_document = yaml.safe_load(path.read_text())
        document = repository.document_model.model_validate(raw_document)
    except Exception as exc:
        # Best-effort label for display -- extra="forbid" or a bad field
        # can still leave a readable `label` key in the raw dict, and
        # naming which entry is broken is more useful than leaving it
        # blank.
        label = raw_document.get("label") if isinstance(raw_document, dict) else None
        return (
            CatalogEntryStatus(
                file=path.name,
                label=label,
                row_id=None,
                row_hash=None,
                state="invalid",
                detail=str(exc),
                deletable=False,
            ),
            None,
        )

    hashable = document.as_hashable_dict()
    hash_value = content_hash(hashable)

    existing = await repository.get_by_hash(db, hash_value)
    if existing is not None:
        return (
            CatalogEntryStatus(
                file=path.name,
                label=document.label,
                row_id=existing.id,
                row_hash=existing.hash,
                state="loaded",
                detail=None,
                deletable=False,
            ),
            existing.id,
        )

    conflicting = await repository.get_by_label(db, document.label)
    if conflicting is not None:
        detail = (
            f"already belongs to a row with hash {conflicting.hash!r}, but this file hashes "
            f"to {hash_value!r} -- {_conflict_resolution_hint()}"
        )
        return (
            CatalogEntryStatus(
                file=path.name,
                label=document.label,
                row_id=conflicting.id,
                row_hash=conflicting.hash,
                state="conflicting",
                detail=detail,
                deletable=False,
            ),
            conflicting.id,
        )

    return (
        CatalogEntryStatus(
            file=path.name,
            label=document.label,
            row_id=None,
            row_hash=hash_value,
            state="new",
            detail="no existing row has this content -- a reload would insert one",
            deletable=False,
        ),
        None,
    )


def _status_for_unclaimed_row(row: RowT) -> CatalogEntryStatus:
    """A row with no file claiming it: `orphaned` if it was a reviewed
    catalog entry (`label` set) -- a delete candidate once Phase 6 ships
    deletion -- or `ad_hoc` if it was minted by resolving a user
    customisation (`label IS NULL`), which never had a file to begin
    with.
    """
    if row.label is not None:
        return CatalogEntryStatus(
            file=None,
            label=row.label,
            row_id=row.id,
            row_hash=row.hash,
            state="orphaned",
            detail=f"no catalog file produces label {row.label!r}",
            deletable=False,
        )
    return CatalogEntryStatus(
        file=None,
        label=None,
        row_id=row.id,
        row_hash=row.hash,
        state="ad_hoc",
        detail=None,
        deletable=False,
    )


def read_source_yaml(
    catalog_dir: Path, repository: CatalogRepository[RowT], label: str
) -> str | None:
    """The raw text of the YAML file a labelled row was loaded from,
    keyed off `label` via `source_yaml_path`'s `/` -> `-` filename
    convention. Read fresh on every call rather than cached or stored:
    this is a low-traffic internal page and the files are small and
    local, so there's nothing to optimise yet.

    Returns `None` (logged) if the file has since been moved or deleted
    -- the row is immutable and outlives the file that created it.
    """
    path = source_yaml_path(catalog_dir, repository, label)
    try:
        return path.read_text()
    except OSError:
        logger.warning("source YAML missing for %s label %s at %s", repository.name, label, path)
        return None
