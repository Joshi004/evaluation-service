"""Read-only summaries computed from data the run pipeline already
writes -- no new files, no per-sample data yet.

Phase 1 of docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md: `report_summary.py`
turns `eval_run.results_json` (the harness report) plus a run's own
`metric` rows into the `RunPerformanceSummary` the run detail page
renders as a health band. Later phases add the per-sample diagnostics
file this package will eventually hold; nothing here reads
`predictions/`, `reviews/`, or `diagnostics/`.
"""
