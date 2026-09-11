"""Deletion and pruning for every catalog (docs/STANDARDS_AND_PROFILES_PHASES.md
Phase 6) -- one module for all three resources, the same reason the
loader takes a `CatalogRepository` rather than importing three sets of
ORM models directly (S-D1).

S-D10 is the whole specification: a row may be deleted only when
nothing references it *and* no catalog file would recreate it. Both
guards are literal here -- a labelled row is blocked for as long as
`catalog/<dir>/<label>.yaml` exists on disk, even if that file's
content no longer matches the row (a `conflicting` state). Fixing a
mistake in place is bump-the-label-version-and-reload; deleting a row
whose file is still present is not a supported path. S-D29 rules out a
force flag that would let a delete cascade into dangling references,
and S-D30 rules out the API ever removing the YAML file itself.
"""

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.catalog import CatalogEntryStatus
from app.services.catalog.paths import source_yaml_path
from app.services.catalog.ports import CatalogRepository, RowT

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DeletionBlocker:
    """One reason a row cannot be deleted right now. `kind` is machine-
    readable for a future caller that wants to branch on it; `detail`
    is the human sentence S-T26 requires -- specific enough to act on,
    e.g. `"3 eval_run(s) reference it"` or
    `"/catalog/standards/gsm8k-v1.yaml still exists"`.
    """

    kind: Literal["referenced", "has_source_file"]
    detail: str


class DeletionBlockedError(Exception):
    """Every blocker joined into one message (S-T26): "cannot delete"
    on its own is not actionable, and naming only the first blocker
    would let a caller fix it and immediately hit the next one.
    """

    def __init__(self, blockers: Sequence[DeletionBlocker]) -> None:
        self.blockers = list(blockers)
        super().__init__("; ".join(blocker.detail for blocker in self.blockers))


def _reference_blockers(counts_for_row: dict[str, int]) -> list[str]:
    """Turn one row's `{table_name: count}` into S-T26's per-table
    sentences. Shared by `deletion_blockers` and `annotate_deletability`
    so the same guard can't end up described two different ways.
    """
    return [f"{count} {table_name}(s) reference it" for table_name, count in counts_for_row.items()]


def _source_file_blocker(
    catalog_dir: Path, repository: CatalogRepository[RowT], label: str | None
) -> str | None:
    """S-D10's second guard: a labelled row whose catalog file still
    exists would be put straight back by the next reload. Calls the
    loader's own path convention (`source_yaml_path`) rather than
    rebuilding it (S-T25) -- a second, subtly different implementation
    is exactly how `ifeval/v1` would report "no file" and get deleted
    out from under itself. `None` for an ad-hoc row (`label is None`),
    which never had a file to begin with.
    """
    if label is None:
        return None
    path = source_yaml_path(catalog_dir, repository, label)
    return f"{path} still exists" if path.exists() else None


async def deletion_blockers(
    db: AsyncSession, catalog_dir: Path, repository: CatalogRepository[RowT], row: RowT
) -> list[DeletionBlocker]:
    """S-D10's two guards for one row the caller has already fetched
    (the only caller, `delete_catalog_row`, needed the row anyway to
    know it exists -- passing `row_id` a second time would just be a
    second lookup).
    """
    counts = await repository.referencing_counts(db, [row.id])
    blockers = [
        DeletionBlocker(kind="referenced", detail=detail)
        for detail in _reference_blockers(counts.get(row.id, {}))
    ]

    source_file_detail = _source_file_blocker(catalog_dir, repository, row.label)
    if source_file_detail is not None:
        blockers.append(DeletionBlocker(kind="has_source_file", detail=source_file_detail))

    return blockers


async def delete_catalog_row(
    db: AsyncSession, catalog_dir: Path, repository: CatalogRepository[RowT], row_id: int
) -> bool:
    """Delete one row if both of S-D10's guards pass.

    Returns `False` for an unknown id so the router can 404, mirroring
    `DELETE /endpoints/{id}`'s own idiom. Raises `DeletionBlockedError`
    (router: 409) if a guard fails -- and also if a concurrent submit
    wins the race between the guard check above and the commit below,
    because the pre-check is the friendly path but must never let a
    live foreign-key violation escape as an unhandled 500.
    """
    row = await repository.get_by_id(db, row_id)
    if row is None:
        return False

    blockers = await deletion_blockers(db, catalog_dir, repository, row)
    if blockers:
        raise DeletionBlockedError(blockers)

    try:
        await repository.delete(db, row)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise DeletionBlockedError(
            [DeletionBlocker(kind="referenced", detail="a reference was added concurrently")]
        ) from exc
    return True


async def prune_ad_hoc_rows(db: AsyncSession, repository: CatalogRepository[RowT]) -> list[int]:
    """Delete every `label IS NULL` row with zero references (S-D31:
    one call per resource, never one route spanning three tables). No
    source-file guard here -- an ad-hoc row never had a file, so S-D10's
    second guard has nothing to check; a zero reference count is the
    only question.

    Each delete runs inside its own savepoint (S-T27): on an active
    system a row can go from unreferenced to referenced between the
    count check below and its delete, and Postgres aborts the *whole*
    transaction on an IntegrityError -- without a savepoint, one row
    losing that race would roll back every row this same call already
    removed.
    """
    candidates = [row for row in await repository.list_all(db) if row.label is None]
    if not candidates:
        return []

    counts = await repository.referencing_counts(db, [row.id for row in candidates])

    deleted_ids: list[int] = []
    for row in candidates:
        if counts.get(row.id):
            continue
        try:
            async with db.begin_nested():
                await repository.delete(db, row)
        except IntegrityError:
            logger.info(
                "skipped pruning %s row %d: a reference was added concurrently",
                repository.name,
                row.id,
            )
            continue
        deleted_ids.append(row.id)

    await db.commit()
    return deleted_ids


async def annotate_deletability(
    db: AsyncSession,
    catalog_dir: Path,
    repository: CatalogRepository[RowT],
    entries: list[CatalogEntryStatus],
) -> list[CatalogEntryStatus]:
    """Fill in `deletable` for every entry `catalog_status` already
    built, folding any blocker into `detail` (Build item 3) -- one
    grouped reference-count query for the whole catalog, not one query
    per row, so a catalog with a few hundred ad-hoc rows stays a
    handful of round trips per `GET /{resource}/catalog-status` call.

    An entry with no `row_id` (`new`, `invalid`) has nothing to delete
    yet and is returned unchanged -- `deletable` stays the `False` it
    was built with.
    """
    row_ids = [entry.row_id for entry in entries if entry.row_id is not None]
    if not row_ids:
        return entries

    counts = await repository.referencing_counts(db, row_ids)

    annotated: list[CatalogEntryStatus] = []
    for entry in entries:
        if entry.row_id is None:
            annotated.append(entry)
            continue

        blockers = _reference_blockers(counts.get(entry.row_id, {}))
        source_file_detail = _source_file_blocker(catalog_dir, repository, entry.label)
        if source_file_detail is not None:
            blockers.append(source_file_detail)

        if not blockers:
            annotated.append(entry.model_copy(update={"deletable": True}))
            continue

        existing_detail = [entry.detail] if entry.detail else []
        detail = "; ".join(existing_detail + blockers)
        annotated.append(entry.model_copy(update={"deletable": False, "detail": detail}))

    return annotated
