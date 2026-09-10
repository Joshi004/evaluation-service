"""`StandardsRepository` -- the `CatalogRepository` implementation over
the `standard` table (docs/STANDARDS_AND_PROFILES_PHASES.md Phase 1,
restructured in Phase 3). The generic loader in
`app.services.catalog.loader` reads and writes `standard` rows only
through this class; it never imports `app.services.standards.queries`
directly.
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Standard
from app.schemas.standards import StandardDocument
from app.services.standards import queries as standards_queries

logger = logging.getLogger(__name__)


class StandardsRepository:
    """A `CatalogRepository[Standard]` over `standards.queries` -- no
    explicit inheritance needed, since `CatalogRepository` is a
    `Protocol` (structural typing), the same relationship
    `SshSlurmClusterRuntime` has to `ClusterRuntime`.
    """

    name = "standards"
    directory_name = "standards"
    document_model = StandardDocument

    async def get_by_hash(self, db: AsyncSession, hash_value: str) -> Standard | None:
        return await standards_queries.get_standard_by_hash(db, hash_value)

    async def get_by_label(self, db: AsyncSession, label: str) -> Standard | None:
        return await standards_queries.get_standard_by_label(db, label)

    async def list_all(self, db: AsyncSession) -> list[Standard]:
        return await standards_queries.list_all_standards(db)

    async def insert(
        self, db: AsyncSession, config: dict[str, Any], hash_value: str, label: str
    ) -> Standard:
        return await standards_queries.insert_standard(db, config, hash_value, label)

    async def sync_unhashed_columns(
        self, db: AsyncSession, row: Standard, unhashed_config: dict[str, Any]
    ) -> None:
        """Phase 4's S-D7 exception in practice: `eval_batch_size` and
        `request_timeout_seconds` can change in the YAML without
        changing `standard.hash`, so a hash hit alone must not be read
        as "nothing to do" here. Only the columns that actually differ
        are written (and logged) -- a reload that changes nothing must
        not spam the log on every startup.
        """
        changed = {
            column: new_value
            for column, new_value in unhashed_config.items()
            if getattr(row, column) != new_value
        }
        if not changed:
            return
        old_values = {column: getattr(row, column) for column in changed}
        await standards_queries.update_standard_columns(db, row, changed)
        logger.info(
            "standard %r: updated operational field(s) %s -> %s (hash unchanged)",
            row.label,
            old_values,
            changed,
        )


# One instance, imported directly by callers -- no factory function
# needed (unlike `app.services.cluster.get_cluster_runtime()`), because
# there is no second implementation to choose between.
standards_repository = StandardsRepository()
