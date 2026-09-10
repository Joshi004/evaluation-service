"""Shapes shared by every catalog (docs/STANDARDS_AND_PROFILES_PHASES.md
Section 0.5): the base a per-catalog YAML document validates against,
and the dry-run report behind every `GET /{resource}/catalog-status`.
"""

from abc import abstractmethod
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class CatalogDocument(BaseModel):
    """Base for every catalog YAML. `extra="forbid"` so a typo'd key
    fails loudly rather than being silently dropped from the hash.

    A subclass that forgets `as_hashable_dict` fails at *instantiation*,
    not just the first time something calls it -- Pydantic v2's
    `ModelMetaclass` already derives from `ABCMeta`, so `@abstractmethod`
    composes with `BaseModel` for free, no separate `ABC` base needed.
    """

    model_config = ConfigDict(extra="forbid")

    label: str

    @abstractmethod
    def as_hashable_dict(self) -> dict[str, Any]:
        """Every field that can change what this catalog entry measures
        or does -- and nothing else. Never `label`.
        """
        raise NotImplementedError

    def as_unhashed_dict(self) -> dict[str, Any]:
        """Fields stored on the row that deliberately do **not**
        participate in its identity hash (S-D7) -- e.g. `standard`'s
        `eval_batch_size`, which changes how fast a benchmark runs, never
        what it measures. Defaults to `{}`: most catalogs have no such
        fields, so only a document with one overrides this.
        """
        return {}


CatalogEntryState = Literal["loaded", "new", "conflicting", "orphaned", "ad_hoc", "invalid"]


class CatalogEntryStatus(BaseModel):
    """One line of a `catalog-status` report -- a YAML file, a database
    row, or (the `loaded` / `conflicting` states) both at once referring
    to each other. See the state table in Section 0.5.
    """

    file: str | None  # filename relative to the catalog subdirectory; None for a row with no file
    label: str | None
    row_id: int | None
    row_hash: str | None
    state: CatalogEntryState
    detail: str | None  # required for every state except 'loaded' and 'ad_hoc'
    deletable: bool  # Phase 6 computes this; Phase 1 ships it hardcoded false


class CatalogStatus(BaseModel):
    """The full dry-run report for one catalog: what a reload would do
    to every file, plus every row a reload would leave untouched
    (orphaned, ad-hoc) -- one call describes the whole catalog.
    """

    catalog: str
    entries: list[CatalogEntryStatus]
