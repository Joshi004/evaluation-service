"""`StandardsRepository` -- the `CatalogRepository` implementation over
the `recipe` table (docs/STANDARDS_AND_PROFILES_PHASES.md Phase 1). The
generic loader in `app.services.catalog.loader` reads and writes
`recipe` rows only through this class; it never imports
`app.services.recipes.queries` directly.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Recipe
from app.schemas.standards import StandardDocument
from app.services.recipes import queries as recipes_queries


class StandardsRepository:
    """A `CatalogRepository[Recipe]` over `recipes.queries` -- no
    explicit inheritance needed, since `CatalogRepository` is a
    `Protocol` (structural typing), the same relationship
    `SshSlurmClusterRuntime` has to `ClusterRuntime`.
    """

    name = "standards"
    directory_name = "standards"
    document_model = StandardDocument

    async def get_by_hash(self, db: AsyncSession, hash_value: str) -> Recipe | None:
        return await recipes_queries.get_recipe_by_hash(db, hash_value)

    async def get_by_label(self, db: AsyncSession, label: str) -> Recipe | None:
        return await recipes_queries.get_recipe_by_label(db, label)

    async def list_all(self, db: AsyncSession) -> list[Recipe]:
        return await recipes_queries.list_all_recipes(db)

    async def insert(
        self, db: AsyncSession, config: dict[str, Any], hash_value: str, label: str
    ) -> Recipe:
        return await recipes_queries.insert_recipe(db, config, hash_value, label)


# One instance, imported directly by callers -- no factory function
# needed (unlike `app.services.cluster.get_cluster_runtime()`), because
# there is no second implementation to choose between.
standards_repository = StandardsRepository()
