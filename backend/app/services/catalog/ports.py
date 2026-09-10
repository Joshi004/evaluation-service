"""The `CatalogRepository` port -- the interface between the generic
catalog loader (`app.services.catalog.loader`) and one specific table
(`recipe` today; `serving_profile` from this phase; `sampling_profile`
from Phase 2). See docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5.

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

    async def list_all(self, db: AsyncSession) -> list[RowT]: ...

    async def insert(
        self, db: AsyncSession, config: dict[str, Any], hash_value: str, label: str
    ) -> RowT: ...
