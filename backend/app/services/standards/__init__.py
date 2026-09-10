"""Loading and validating benchmark standards.

EVAL_SERVICE_PLAN.md, Section 5: each benchmark has a version-controlled
standard YAML file under `catalog/standards/` (see ../../../../catalog
and docker-compose.yml, which mounts the whole `catalog/` root read-only
into this container) describing the benchmark protocol -- dataset,
few-shot, prompt template, extraction, metrics -- identical for every
model, fixed by us. What sampling a benchmark's own definition mandates
lives on the same row as `sampling_overrides`, merged ahead of a run's
own sampling profile pick (docs/STANDARDS_AND_PROFILES_PHASES.md Section
0.5, Phase 3).

`repository.py` (Phase 1) adapts this catalog to
`app.services.catalog.loader`'s generic loader, which parses and
strictly validates those files with Pydantic (a typo in a standard
should fail loudly, not silently) and loads them into the `standard`
table -- idempotent, since the row is content-addressed. `resolve.py` is
the same insert-if-new path for a user override at submit time, and
`capabilities.py` holds the one per-framework table decision D4 needs
(docs/IMPLEMENTATION_PHASES.md Section 0.8).
"""
