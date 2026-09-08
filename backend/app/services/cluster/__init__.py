"""The SSH connector to the SLURM cluster.

Docs/IMPLEMENTATION_PHASES.md Phase 3 specifies a narrow six-method
interface that everything above this module depends on instead of
knowing SSH is involved at all:

    submit, status, cancel, logs, stage_file, open_tunnel

All six were validated by hand over plain SSH — see CLUSTER_VALIDATION.md,
Section 2 — and are implemented in `connector.py` using `asyncssh`, with a
single kept-alive connection to the login node (a cold connect is ~16s, a
reused one ~1s) and `ProxyJump` to reach compute nodes directly.

- `connector.py` -- the six methods themselves, plus the pooled connection.
- `tunnel.py` -- supervises the local forward `open_tunnel` returns: one
  per live endpoint, rebuilt on demand rather than trusted blindly.
- `serve_job.py` -- renders the parameterised vLLM sbatch script and
  parses its log for the readiness/liveness markers.
"""
