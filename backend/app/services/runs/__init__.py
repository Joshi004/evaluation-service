"""The run pipeline: submit, the per-run worker, cancel, and startup
recovery. See docs/IMPLEMENTATION_PHASES.md Phase 5 and
docs/DATA_MODEL_V1.md Section 3.6.

- `submit.py` -- validates a submit's checkpoint x recipe grid, resolves
  each recipe (Phase 2's `resolve_recipe`), and inserts the run_group and
  the queued eval_run rows.
- `worker.py` -- the per-run pipeline: reuse-or-start an endpoint, run the
  harness, parse and persist the result -- plus the cancel path, since
  cancelling has to reach the same task registry and locks this module
  owns.
- `recovery.py` -- the startup UPDATE that fails any run left `queued` or
  `running` by an unclean stop.
- `queries.py` -- the DB access for all of the above.
"""
