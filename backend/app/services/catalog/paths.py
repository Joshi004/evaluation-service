"""The one label -> filename convention every catalog uses (S-T25):
`/` becomes `-`, suffixed `.yaml`, under `catalog_dir / repository.directory_name`.

Pulled out of `app.services.catalog.loader` so `app.services.catalog.deletion`
can check whether a labelled row's source file still exists (S-D10's
second guard) without re-deriving the path a second, subtly different
way -- and without an import cycle: `loader.catalog_status` calls into
`deletion.annotate_deletability`, so the path helper can't live in
either module and be imported by the other.
"""

from pathlib import Path

from app.services.catalog.ports import CatalogRepository, RowT


def source_yaml_path(catalog_dir: Path, repository: CatalogRepository[RowT], label: str) -> Path:
    """Where a labelled row's catalog YAML would live, whether or not a
    file is actually there. Callers that need to know if the file
    exists check `.exists()` on the result; `loader.read_source_yaml`
    calls this then reads the text.
    """
    return catalog_dir / repository.directory_name / f"{label.replace('/', '-')}.yaml"
