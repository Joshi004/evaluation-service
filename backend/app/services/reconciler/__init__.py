"""The reconciler loop.

EVAL_SERVICE_PLAN.md, Section 10: a loop that runs on a fixed interval
(e.g. every 20 seconds), looks at everything unfinished (eval_run,
endpoint, job rows), asks the cluster what's happening via one bulk
`squeue`-equivalent call through app.services.cluster, and moves each row
forward one step in the state machine described there.

Deliberately not a long-lived task per job — a worker blocked on `squeue`
for hours would die on the first deploy and take its state with it. The
reconciler pattern also absorbs a dropped SSH connection or a login-node
pod restart as a reconnect on the next tick, not an incident.

Not implemented yet.
"""
