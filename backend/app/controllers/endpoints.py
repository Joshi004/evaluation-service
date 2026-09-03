"""Served-endpoint controller.

Will orchestrate calls into app.services.cluster to list served models
and handle the manual kill action, and shape responses for
app.api.v1.endpoints. Node/GPU info is always refreshed from the cluster,
never trusted from the stored row — see EVAL_SERVICE_PLAN.md, Section 10.

Not implemented yet.
"""
