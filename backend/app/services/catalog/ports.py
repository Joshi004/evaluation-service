"""The `CatalogRepository` port -- the interface between the generic
catalog loader (`app.services.catalog.loader`) and one specific table
(`standard`, `serving_profile`, `sampling_profile`). See
docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5.

Parameterising the loader by a small object with named methods, rather
than three loose functions passed positionally, mirrors
`app.services.cluster.ports` (S-D17): three functions passed
positionally are three chances to pass them in the wrong order, and this
codebase already chose the named-object idiom for exactly that problem.
An implementation does not need to subclass `CatalogRepository` --
structural typing is the point of a `Protocol`, and neither
`SshSlurmClusterRuntime` nor `SshModelDiscovery` subclasses its own port
either.
"""

from collections.abc import Sequence
from typing import Any, Protocol, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.catalog import CatalogDocument


class CatalogRow(Protocol):
    """The three columns every catalog table's ORM row has in common --
    enough for the loader to report a row's identity in a
    `catalog-status` entry without knowing which table it came from.
    """

    id: int
    hash: str
    label: str | None


RowT = TypeVar("RowT", bound=CatalogRow)


class CatalogRepository(Protocol[RowT]):
    """One implementation per catalog:
    `app.services.standards.repository`,
    `app.services.serving_profiles.repository`, and (Phase 2)
    `app.services.sampling_profiles.repository`. The loader in
    `app.services.catalog.loader` knows nothing about which table it is
    reading or writing.
    """

    name: str  # 'standards' | 'sampling-profiles' | 'serving-profiles'
    directory_name: str  # the subdirectory under catalog_dir
    document_model: type[CatalogDocument]

    async def get_by_hash(self, db: AsyncSession, hash_value: str) -> RowT | None: ...

    async def get_by_label(self, db: AsyncSession, label: str) -> RowT | None: ...

    async def get_by_id(self, db: AsyncSession, row_id: int) -> RowT | None: ...

    async def list_all(self, db: AsyncSession) -> list[RowT]: ...

    async def insert(
        self, db: AsyncSession, config: dict[str, Any], hash_value: str, label: str
    ) -> RowT: ...

    async def sync_unhashed_columns(
        self, db: AsyncSession, row: RowT, unhashed_config: dict[str, Any]
    ) -> None:
        """A hash *hit* can still mean an unhashed operational column
        (S-D7, e.g. standard's `eval_batch_size`) drifted in the YAML --
        the file stays that field's source of truth even though it isn't
        part of identity. Most catalogs have no such column, so a no-op
        implementation is correct there (see
        `app.services.sampling_profiles.repository`,
        `app.services.serving_profiles.repository`).
        """
        ...

    async def referencing_counts(
        self, db: AsyncSession, row_ids: Sequence[int]
    ) -> dict[int, dict[str, int]]:
        """S-D10's first deletion guard, batched: for every id in
        `row_ids`, how many rows of each referencing table point at it
        -- e.g. `{7: {"eval_run": 3}, 9: {"checkpoint": 1}}`. A row with
        no referencing rows at all is simply absent from the result
        (Phase 6, Build item 3): one grouped `SELECT ... GROUP BY`
        per referencing column, never one query per row, so a
        `catalog-status` call over a few hundred ad-hoc rows stays a
        handful of round trips.
        """
        ...

    async def delete(self, db: AsyncSession, row: RowT) -> None:
        """Delete this row. Flushes but deliberately does **not**
        commit -- `app.services.catalog.deletion.prune_ad_hoc_rows`
        wraps each row's delete in its own `db.begin_nested()` savepoint
        (S-T27) so one row losing a race against a concurrent submit's
        new foreign key doesn't roll back every row already removed in
        the same prune; the caller commits once, after the whole loop.
        """
        ...
