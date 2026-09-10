"""Standards controller -- orchestrates the catalog loader/query calls
and shapes the response: attaches decision D4's per-field warning and
the standard's raw YAML source text, neither of which the `standard`
table stores. See .cursor/rules/backend-layering.mdc.
"""

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Standard
from app.schemas.catalog import CatalogStatus
from app.schemas.standards import StandardSummary
from app.services.catalog import loader as catalog_loader
from app.services.standards import queries as standards_queries
from app.services.standards.capabilities import sampling_field_warnings
from app.services.standards.repository import standards_repository


async def list_standards(db: AsyncSession, *, include_ad_hoc: bool) -> list[StandardSummary]:
    catalog_dir = Path(get_settings().catalog_dir)
    standards = await standards_queries.list_standards(db, include_ad_hoc=include_ad_hoc)
    return [_to_standard_summary(standard, catalog_dir) for standard in standards]


async def reload_standards(db: AsyncSession) -> list[StandardSummary]:
    catalog_dir = Path(get_settings().catalog_dir)
    await catalog_loader.load_catalog(db, catalog_dir, standards_repository)
    standards = await standards_queries.list_standards(db, include_ad_hoc=False)
    return [_to_standard_summary(standard, catalog_dir) for standard in standards]


async def get_catalog_status(db: AsyncSession) -> CatalogStatus:
    catalog_dir = Path(get_settings().catalog_dir)
    return await catalog_loader.catalog_status(db, catalog_dir, standards_repository)


def _to_standard_summary(standard: Standard, catalog_dir: Path) -> StandardSummary:
    """`source_yaml` is `None` for an ad-hoc row (`label` is `None`) --
    it was minted from a submit-time override, not loaded from a file,
    so there is no `catalog/standards/*.yaml` to re-read
    (`StandardSummary`'s own docstring); `read_source_yaml` requires a
    real label and must not be called for one.
    """
    source_yaml = (
        catalog_loader.read_source_yaml(catalog_dir, standards_repository, standard.label)
        if standard.label is not None
        else None
    )
    return StandardSummary(
        id=standard.id,
        hash=standard.hash,
        label=standard.label,
        benchmark=standard.benchmark,
        framework=standard.framework,
        framework_image=standard.framework_image,
        task_name=standard.task_name,
        dataset_name=standard.dataset_name,
        dataset_revision=standard.dataset_revision,
        split=standard.split,
        few_shot=standard.few_shot,
        prompt_template=standard.prompt_template,
        extraction=standard.extraction,
        metrics=standard.metrics,
        repeats=standard.repeats,
        sample_limit=standard.sample_limit,
        think_handling=standard.think_handling,
        sampling_overrides=standard.sampling_overrides,
        subsets=standard.subsets,
        eval_batch_size=standard.eval_batch_size,
        request_timeout_seconds=standard.request_timeout_seconds,
        created_at=standard.created_at,
        warnings=sampling_field_warnings(standard.framework, standard.sampling_overrides),
        source_yaml=source_yaml,
    )
