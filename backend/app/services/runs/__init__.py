"""The run pipeline: submit, the per-run worker, cancel, and startup
recovery. See docs/IMPLEMENTATION_PHASES.md Phase 5 and
docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3 for the standard/sampling
split.

- `submit.py` -- validates a submit's checkpoint x standard grid,
  resolves each standard and each pair's sampling profile
  (`resolve_standard`, `resolve_sampling_profile`), and inserts the
  run_group and the queued eval_run rows.
- `comparison.py` -- `comparison_hash`, what the leaderboard groups by.
- `worker.py` -- the per-run pipeline: reuse-or-start an endpoint, run the
  harness, parse and persist the result -- plus the cancel path, since
  cancelling has to reach the same task registry and locks this module
  owns.
- `recovery.py` -- the startup UPDATE that fails any run left `queued` or
  `running` by an unclean stop.
- `queries.py` -- the DB access for all of the above.
"""
