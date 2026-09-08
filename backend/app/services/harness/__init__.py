"""Runs EvalScope against a live endpoint and turns its output into
`metric` rows, `results_json`, and a `truncation_rate`. See
docs/IMPLEMENTATION_PHASES.md Phase 4.

EvalScope itself is never imported here or anywhere else in the backend
process (decision D2 keeps its dependency tree out of the API process)
-- `harness/evalscope/run_eval.py`, baked into the harness image, is the
only place `from evalscope import TaskConfig, run_task` actually runs.

- `task_config.py` -- builds the EvalScope task config as a plain dict
  (recipe + checkpoint + endpoint -> dict), since the real `TaskConfig`
  class lives on the other side of the docker socket.
- `runner.py` -- writes that dict to the run directory and spawns the
  harness container that consumes it.
- `parser.py` -- pure functions turning the container's output tree
  into a `results_json` blob, per-metric values, and a truncation rate.
- `queries.py` -- the DB writes for the above, kept separate so the
  parser stays session-free.
"""
