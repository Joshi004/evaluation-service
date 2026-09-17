"""Per-benchmark modules (Section 3.4 of
docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md): buckets, the instruction-
level reconciliation, and eventually (Phase 7) the Layer 5 renderer.
`registry.py` is what points a benchmark name at the right module's
functions; nothing outside `registry.py` imports a module from this
package directly.
"""
