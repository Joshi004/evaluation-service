"""The SSH connector to the SLURM cluster.

EVAL_SERVICE_PLAN.md, Section 6, specifies a narrow six-method interface
that everything above this module should depend on instead of knowing SSH
is involved at all:

    submit, status, cancel, logs, stage_file, open_tunnel

All six were validated by hand over plain SSH — see CLUSTER_VALIDATION.md,
Section 2 — using `asyncssh` with connection pooling (a cold connect is
~16s, a reused one ~1s) and `ProxyJump` to reach compute nodes directly.

Not implemented yet. `asyncssh` will be added as a dependency when this is
built out.
"""
