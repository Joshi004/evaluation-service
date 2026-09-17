"""Turns `eval_run.results_json` plus the run's own `metric` rows into
the `RunPerformanceSummary` the run detail page renders as a health
band.

Pure function: a report dict and already-computed metric rows in, a
Pydantic model out -- no DB session, same discipline as
`app/services/harness/parser.py`. Deliberately doesn't import from
`parser.py`: that module runs once, at harness-completion time, to
produce `results_json` and the metric rows in the first place; this
module only ever reads them back, on every run-detail request.
"""

import math
from typing import Any

from app.schemas.diagnostics import (
    ConfidenceInterval,
    LatencySeconds,
    MetricDisplay,
    MetricPerformance,
    OutputTokens,
    RunPerformanceSummary,
    Throughput,
)
from app.schemas.runs import RunMetric

# z-score for a two-sided 95% interval.
_Z_95 = 1.959963984540054


def summarize_run_performance(
    results_json: dict[str, Any] | None,
    metric_specs: list[dict[str, Any]],
    metric_rows: list[RunMetric],
) -> RunPerformanceSummary | None:
    """`results_json` is `None` for a queued, running, failed or
    cancelled run -- it's only ever populated once the harness result is
    recorded, and the run page must render nothing rather than a block
    of zeros before that happens.

    `metric_specs` is `standard.metrics` (the JSONB list of
    `StandardMetricDefinition.model_dump()` dicts); `metric_rows` is
    this run's own `metric` table rows. Iterating `metric_specs` rather
    than `metric_rows` keeps the primary-first order the YAML and
    `RunStandardDetail.metrics` already use, instead of the alphabetical
    order `queries.get_run_detail` sorts `metric_rows` in.
    """
    if results_json is None:
        return None

    display_by_harness_key = {
        _harness_key(report_metric): _to_display(report_metric.get("semantics", {}))
        for report_metric in results_json.get("metrics", [])
    }

    metric_row_by_name = {metric_row.name: metric_row for metric_row in metric_rows}
    metrics = [
        _to_metric_performance(spec, metric_row_by_name[spec["name"]], display_by_harness_key)
        for spec in metric_specs
        if spec["name"] in metric_row_by_name
    ]

    primary_metric = next((metric for metric in metrics if metric.is_primary), None)
    latency_seconds, output_tokens, throughput = _read_performance_costs(results_json)

    return RunPerformanceSummary(
        n_samples=primary_metric.n_samples if primary_metric else None,
        primary_metric_name=primary_metric.name if primary_metric else None,
        metrics=metrics,
        latency_seconds=latency_seconds,
        output_tokens=output_tokens,
        throughput=throughput,
    )


def _to_metric_performance(
    spec: dict[str, Any],
    metric_row: RunMetric,
    display_by_harness_key: dict[str, MetricDisplay],
) -> MetricPerformance:
    passed: int | None = None
    failed: int | None = None
    confidence_interval: ConfidenceInterval | None = None

    # Only the primary metric is a genuine per-sample pass rate for
    # every benchmark in the catalog today -- see MetricPerformance's
    # own docstring for why inst_level_strict/loose can't get one too.
    if metric_row.is_primary and metric_row.n_samples:
        passed = _derive_pass_count(metric_row.value, metric_row.n_samples)
        failed = metric_row.n_samples - passed
        confidence_interval = wilson_interval(metric_row.value, metric_row.n_samples)

    return MetricPerformance(
        name=metric_row.name,
        display_name=spec["display_name"],
        value=metric_row.value,
        n_samples=metric_row.n_samples,
        is_primary=metric_row.is_primary,
        passed=passed,
        failed=failed,
        confidence_interval=confidence_interval,
        display=display_by_harness_key.get(spec["harness_key"]),
    )


def _derive_pass_count(value: float, n_samples: int) -> int:
    """`round(value * n_samples)` recovers the exact integer count that
    produced this fraction, for a pass-rate metric. A later phase of
    docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md replaces this with the true
    counted value read from a per-sample diagnostics file; kept as one
    function so that swap touches only this line.
    """
    return round(value * n_samples)


def wilson_interval(value: float, n_samples: int) -> ConfidenceInterval:
    """The Wilson score interval, not the normal approximation -- the
    normal approximation can push its upper bound past 1.0 and
    understates how wide the true interval is as a score approaches 1,
    which every primary metric in this catalog does
    (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 1).

    Public (not `_`-prefixed): Phase 9's compare page reuses this
    exact implementation for each side's own interval rather than
    keeping a second copy of the formula
    (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 9).
    """
    denominator = 1 + _Z_95 * _Z_95 / n_samples
    center = (value + _Z_95 * _Z_95 / (2 * n_samples)) / denominator
    half_width = (_Z_95 / denominator) * math.sqrt(
        value * (1 - value) / n_samples + _Z_95 * _Z_95 / (4 * n_samples * n_samples)
    )
    return ConfidenceInterval(
        lower=max(0.0, center - half_width),
        upper=min(1.0, center + half_width),
    )


def _harness_key(report_metric: dict[str, Any]) -> str:
    """Renders "name:aggregation", e.g. "prompt_level_strict:mean" --
    the same convention `standard.metrics[i]["harness_key"]` is written
    in, and the same one `app/services/harness/parser.py::_harness_key`
    reconstructs on the write path. Kept as its own small copy rather
    than importing that (module-private) function: this module only
    ever reads a report already on disk, long after parser.py finished
    writing it.
    """
    identity = report_metric["identity"]
    return f"{identity['name']}:{identity['aggregation']}"


def _to_display(semantics: dict[str, Any]) -> MetricDisplay:
    return MetricDisplay(
        display_kind=semantics.get("display_kind", "number"),
        display_multiplier=semantics.get("display_multiplier"),
        display_unit=semantics.get("display_unit"),
        display_precision=semantics.get("display_precision", 0),
        direction=semantics.get("direction", "none"),
    )


def _read_performance_costs(
    results_json: dict[str, Any],
) -> tuple[LatencySeconds | None, OutputTokens | None, Throughput | None]:
    """Reads `results_json["perf_metrics"]["summary"]` -- verified
    present, with this exact shape, in every report checked across all
    five catalog benchmarks (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
    Phase 1). Guards the block's own presence rather than every leaf
    inside it: a harness that omits `perf_metrics` entirely should still
    render a health band with counts and no cost lines, not a 500.
    """
    summary = results_json.get("perf_metrics", {}).get("summary")
    if not summary:
        return None, None, None

    latency = summary.get("latency")
    latency_seconds = (
        LatencySeconds(
            mean=latency["mean"],
            p50=latency["50%"],
            p90=latency["90%"],
            p99=latency["99%"],
            max=latency["max"],
        )
        if latency
        else None
    )

    usage = summary.get("usage", {})
    output_tokens_usage = usage.get("output_tokens")
    output_tokens = (
        OutputTokens(
            mean=output_tokens_usage["mean"],
            max=output_tokens_usage["max"],
            total=usage.get("total_output_tokens", 0),
        )
        if output_tokens_usage
        else None
    )

    throughput_usage = summary.get("throughput")
    throughput = (
        Throughput(
            output_tokens_per_second=throughput_usage["avg_output_tps"],
            requests_per_second=throughput_usage["avg_req_ps"],
        )
        if throughput_usage
        else None
    )

    return latency_seconds, output_tokens, throughput
