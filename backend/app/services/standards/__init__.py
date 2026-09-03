"""Loading and validating benchmark standards.

EVAL_SERVICE_PLAN.md, Section 5: each benchmark has a version-controlled
recipe YAML file under /standards (see ../../../../standards and
docker-compose.yml, which mounts it read-only into this container)
describing:

  - Layer 1, the benchmark protocol (dataset, few-shot, prompt template,
    extraction, metrics) — identical for every model, fixed by us.
  - Layer 2 defaults (sampling, think handling, max_tokens) — the
    "benchmark default" source a run can pick, per Section 5's three-way
    choice.

This module will parse and strictly validate those files with Pydantic
(a typo in a recipe should fail loudly, not silently) and load them into
the `recipe` table.

Not implemented yet.
"""
