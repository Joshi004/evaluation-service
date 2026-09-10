"""Loading and validating benchmark standards.

EVAL_SERVICE_PLAN.md, Section 5: each benchmark has a version-controlled
recipe YAML file under `catalog/standards/` (see ../../../../catalog and
docker-compose.yml, which mounts the whole `catalog/` root read-only into
this container) describing:

  - Layer 1, the benchmark protocol (dataset, few-shot, prompt template,
    extraction, metrics) — identical for every model, fixed by us.
  - Layer 2 defaults (sampling, think handling, max_tokens) — the
    "benchmark default" source a run can pick, per Section 5's three-way
    choice.

`repository.py` (docs/STANDARDS_AND_PROFILES_PHASES.md Phase 1) adapts
this catalog to `app.services.catalog.loader`'s generic loader, which
parses and strictly validates those files with Pydantic (a typo in a
recipe should fail loudly, not silently) and loads them into the
`recipe` table -- idempotent, since the row is content-addressed.
`resolve.py` is the same insert-if-new path for a user override at
submit time (Phase 6), and `capabilities.py` holds the one per-framework
table decision D4 needs (docs/IMPLEMENTATION_PHASES.md Section 0.8).
"""
