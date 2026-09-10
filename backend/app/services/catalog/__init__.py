"""The generic catalog mechanism: one loader, parameterised by a
`CatalogRepository`, for every reviewed-YAML-backed table (`standard`,
`serving_profile`, and from Phase 2 `sampling_profile`). See
docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5 and Phase 1.

- `ports.py` -- the `CatalogRepository` Protocol and its `RowT` bound.
- `loader.py` -- `load_catalog`, `catalog_status`, and `read_source_yaml`,
  generalised from `app.services.standards.loader`.
"""
