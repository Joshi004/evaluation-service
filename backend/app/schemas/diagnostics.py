"""Response shapes for the run detail page's performance/health band.

Phase 1 of docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md: everything here is
computed from `eval_run.results_json` (the harness report, stored
verbatim) plus the run's own `metric` rows -- no file reads, no
per-sample data. Section 3.2 of that document defines the eventual
per-run diagnostics file; the nested shapes below (`LatencySeconds`,
`OutputTokens`) reuse its field names on purpose, so a later phase can
reuse these models instead of minting parallel ones.
"""

from typing import Any

from pydantic import BaseModel


class MetricDisplay(BaseModel):
    """The harness's own rendering hint for one metric, read from
    `results_json["metrics"][i]["semantics"]` -- what lets a benchmark
    that reports seconds or tokens-per-second render correctly with no
    frontend change, instead of every page hardcoding percent
    formatting.
    """

    display_kind: str
    display_multiplier: float | None
    display_unit: str | None
    display_precision: int
    direction: str


class ConfidenceInterval(BaseModel):
    """A 95% Wilson interval over a pass-rate metric's `value` and
    `n_samples`. Only ever set on a metric that is a genuine per-sample
    pass rate -- see `MetricPerformance.confidence_interval`.
    """

    lower: float
    upper: float


class MetricPerformance(BaseModel):
    """One of the run's `metric` rows, enriched with a pass count, a
    confidence interval, and a display hint.

    `passed`/`failed`/`confidence_interval` are `None` for every
    non-primary metric. IFEval/IFBench's `inst_level_*` metrics are a
    macro average of each sample's own pass ratio, not a pooled
    pass/fail count -- deriving a count from that average would count
    instructions that were never separately tallied
    (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4, "Layer 3"). The primary
    metric is a true per-sample pass rate for every benchmark in the
    catalog today, so it is the only one this is safe for.
    """

    name: str
    display_name: str
    value: float
    n_samples: int | None
    is_primary: bool
    passed: int | None
    failed: int | None
    confidence_interval: ConfidenceInterval | None
    display: MetricDisplay | None


class LatencySeconds(BaseModel):
    """`results_json["perf_metrics"]["summary"]["latency"]`, the five
    percentiles the run page's health line shows.
    """

    mean: float
    p50: float
    p90: float
    p99: float
    max: float


class OutputTokens(BaseModel):
    """`results_json["perf_metrics"]["summary"]["usage"]["output_tokens"]`
    plus the run-wide total from `usage.total_output_tokens`.
    """

    mean: float
    max: float
    total: int


class Throughput(BaseModel):
    """`results_json["perf_metrics"]["summary"]["throughput"]`."""

    output_tokens_per_second: float
    requests_per_second: float


class RunPerformanceSummary(BaseModel):
    """`RunDetail.performance` -- `None` for a queued, running, failed
    or cancelled run, since `results_json` doesn't exist yet.
    """

    n_samples: int | None
    primary_metric_name: str | None
    metrics: list[MetricPerformance]
    latency_seconds: LatencySeconds | None
    output_tokens: OutputTokens | None
    throughput: Throughput | None


# --- Phase 3: the diagnostics API (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
# Section 3.5) -------------------------------------------------------------
#
# Everything below mirrors app/services/diagnostics/records.py field for
# field -- that module's dataclasses are what store.load_or_build hands
# back (as a plain dict, round-tripped through json.dumps/json.loads), so
# these models are how the controller re-validates that dict into a typed
# response, per .cursor/rules/backend-layering.mdc.


class DiagnosticsMetric(BaseModel):
    """One of `summary.metrics` -- mirrors `records.MetricSummary`.
    `passed` is `None` for a macro-averaged metric (e.g. IFEval's
    `inst_level_strict`), same rule as `MetricPerformance.passed` above.
    """

    name: str
    display_name: str
    value: float
    n_samples: int
    passed: int | None


class DiagnosticsSubset(BaseModel):
    """One subset's counts -- mirrors `records.SubsetSummary`, minus
    `file`. That field exists for Phase 7's by-index full-text lookup;
    it is an internal detail, not something this API exposes.
    """

    name: str
    n_samples: int
    passed: int


class DiagnosticsHealth(BaseModel):
    """Mirrors `records.HealthSummary`. Reuses the `LatencySeconds`/
    `OutputTokens` models above field-for-field -- they were named to
    match this shape on purpose (see this file's module docstring).
    """

    truncated: int
    empty_answers: int
    errored_requests: int
    latency_seconds: LatencySeconds | None
    output_tokens: OutputTokens | None


class DiagnosticsInstructionLevel(BaseModel):
    """Mirrors `records.InstructionLevelSummary` (Phase 5). Reconciles
    the harness's own macro-averaged instruction-level score against
    the pooled (micro) view a bucket breakdown necessarily is --
    `None` for a benchmark with no instruction-level metrics at all
    (GSM8K, GPQA-Diamond, MMLU-Pro).
    """

    macro_metric_name: str
    macro_value: float
    micro_value: float
    micro_passed: int
    micro_total: int
    # `None` when the recheck never ran for this run -- expect this to
    # differ from `micro_passed` by a couple of instructions even when
    # it did (decision 4's two random-letter samples, never
    # reconciled).
    recheck_passed: int | None


class DiagnosticsTagCount(BaseModel):
    """One row of the tag chip row -- mirrors `records.TagCount`
    (Phase 8). How many failing samples carry this tag, across the
    whole run.
    """

    tag: str
    n_samples: int


class DiagnosticsSummary(BaseModel):
    """Mirrors `records.DiagnosticsSummary`. `tag_counts`/`narrative`
    are Phase 8's failure tags and deterministic written summary --
    see `records.TagCount` and `app/services/diagnostics/narrate.py`
    for how each is built.
    """

    n_samples: int
    primary_metric_name: str
    primary_metric_display_name: str
    passed: int
    failed: int
    metrics: list[DiagnosticsMetric]
    health: DiagnosticsHealth
    subsets: list[DiagnosticsSubset]
    instruction_level: DiagnosticsInstructionLevel | None
    tag_counts: list[DiagnosticsTagCount]
    narrative: list[str]


class DiagnosticsSource(BaseModel):
    """Mirrors `records.DiagnosticsSource`."""

    eval_run_id: int
    benchmark: str
    task_name: str
    served_model_name: str
    harness_image: str
    reviews_files: list[str]


class DiagnosticsBucket(BaseModel):
    """One row of Layer 3's breakdown table -- mirrors `records.Bucket`
    (Phase 5). `level` distinguishes which table a row belongs to
    ("family" or "rule" for IFEval/IFBench; "subject" for MMLU-Pro).

    `passed`/`pass_rate` are `None` when the only thing known is which
    instructions exist in this bucket, not how many passed -- a failed
    recheck still produces buckets from `instruction_id_list` alone,
    with per-rule detail marked unavailable rather than guessed at.
    """

    name: str
    level: str
    n_instructions: int
    passed: int | None
    pass_rate: float | None


class RunDiagnostics(BaseModel):
    """`GET /runs/{run_id}/diagnostics` and the rebuild endpoint's
    response -- summary and buckets, deliberately with no `samples`
    field. Section 3.5 requires this endpoint to never return the
    samples array; Pydantic's default `extra="ignore"` is what drops
    that key on `model_validate(payload)` with no manual stripping.
    """

    schema_version: int
    generated_at: str
    source: DiagnosticsSource
    summary: DiagnosticsSummary
    buckets: list[DiagnosticsBucket]


class DiagnosticsSample(BaseModel):
    """One of `summary.samples` -- mirrors `records.SampleRecord` field
    for field. `benchmark_details` stays opaque here too (Section
    3.2): only a benchmark module and the Layer 5 renderer (both later
    phases) look inside it.
    """

    sample_key: str
    index: int
    subset: str
    passed: bool
    scores: dict[str, float]
    input_preview: str
    output_preview: str
    target: str
    tokens_in: int | None
    tokens_out: int | None
    latency_seconds: float | None
    stop_reason: str | None
    has_reasoning: bool
    tags: list[str]
    benchmark_details: dict[str, Any]


class SamplePage(BaseModel):
    """`GET /runs/{run_id}/samples` -- `total` is the count after
    filtering, before paging (Section 3.5), so a caller pages through
    exactly what `total` promises.
    """

    total: int
    items: list[DiagnosticsSample]


# --- Phase 7: the sample detail page (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
# Section 4, "Layer 5") -----------------------------------------------------


class RuleCheck(BaseModel):
    """One row of Layer 5's per-rule checklist -- mirrors
    `records.RuleCheck` field for field. `strict`/`loose` are `None`
    when the sample's own `rule_results` was never filled in (Phase 7:
    "When `rule_results` is null, show the scores and the rule list
    without ticks").
    """

    rule_id: str
    description: str
    strict: bool | None
    loose: bool | None


class SampleText(BaseModel):
    """The full, untruncated text for one sample -- mirrors
    `records.SampleText` field for field. Read from the reviews file
    on demand, by `index`, and never stored in the diagnostics file
    itself (Section 3.2).
    """

    prompt: str
    answer: str
    reasoning: str
    target: str
    extracted_prediction: str
    explanation: str | None


class DiagnosticsSampleDetail(DiagnosticsSample):
    """`GET /runs/{run_id}/samples/{sample_key}`'s real response shape
    (Phase 7) -- everything `DiagnosticsSample` already carries, plus
    the full text and, for IFEval/IFBench, the per-rule checklist.

    `text` is `None` only when the run's reviews file has no line
    matching this sample's `index` -- a pruned or corrupted run
    folder, not something expected on any run that reached `done`.
    `rules` is `[]` for every benchmark without a checklist (Section
    3.4), not `None` -- an empty list is what "nothing to show here"
    already means everywhere else in this file (`RunDiagnostics.buckets`).
    """

    text: SampleText | None
    rules: list[RuleCheck]


# --- Phase 9: the compare page (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
# Section 4, "Sideways -- Compare mode") ------------------------------------


class ComparisonSide(BaseModel):
    """One run's own identity and primary score, as shown on its own
    score card. `confidence_interval` reuses the same Wilson interval
    Phase 1's `MetricPerformance` computes --
    `report_summary.wilson_interval` is the one shared implementation,
    not a second copy of the formula.
    """

    eval_run_id: int
    benchmark: str
    served_model_name: str
    primary_metric_name: str
    primary_metric_display_name: str
    value: float
    n_samples: int
    passed: int
    failed: int
    confidence_interval: ConfidenceInterval | None


class ComparisonOverlap(BaseModel):
    """How much of each run's own sample set the join actually covers
    -- reported even on a refusal ("Report the overlap count either
    way"), so a refused comparison still says why rather than just
    stopping.
    """

    n_shared: int
    left_only: int
    right_only: int


class ComparisonDelta(BaseModel):
    """`value` is `right.value - left.value`. `is_significant` is the
    standard two-proportion difference test: `abs(value)` against the
    two runs' own Wilson half-widths combined in quadrature
    (`sqrt(left_hw**2 + right_hw**2)`), not a simple interval-overlap
    check -- a 1.3-point move at +-4 points is noise
    (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4) and this is the
    threshold that says so.
    """

    value: float
    combined_half_width: float
    is_significant: bool


class FlipSample(BaseModel):
    """One row of a flip list. `left_score`/`right_score` are each
    side's own primary-metric value for this sample -- almost always
    0.0 or 1.0, since that is what `passed` is derived from; `None`
    only if a sample's `scores` somehow lacks that metric's key.
    `subset`/`input_preview` come from the left run's own record --
    identical to the right run's for any sample sharing a
    `sample_key`, so there is only one to carry.
    """

    sample_key: str
    subset: str
    input_preview: str
    left_output_preview: str
    right_output_preview: str
    left_score: float | None
    right_score: float | None


class ComparisonBucketDelta(BaseModel):
    """One row of the bucket-delta table -- a full outer join on
    `(level, name)` across both runs' own `buckets` (Section 3.2).
    Per-side fields are `None` when that bucket doesn't exist on that
    side at all (e.g. a rule the other run's recheck never produced),
    never guessed at. `pass_rate_delta` is `None` under the same
    condition, since a delta needs both sides.
    """

    name: str
    level: str
    left_n_instructions: int | None
    left_passed: int | None
    left_pass_rate: float | None
    right_n_instructions: int | None
    right_passed: int | None
    right_pass_rate: float | None
    pass_rate_delta: float | None


class RunComparison(BaseModel):
    """`GET /runs/{run_id}/compare/{other_run_id}`'s response (Phase
    9). `comparable=False` means `delta` is `None` and both flip lists
    are `[]` -- `refusal_reason` is the plain-English reason why
    (different benchmarks, or too little sample-key overlap), and
    `overlap` is still populated either way so the refusal is legible
    rather than silent (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4: "a
    misleading diff is worse than a refusal").
    """

    left: ComparisonSide
    right: ComparisonSide
    overlap: ComparisonOverlap
    comparable: bool
    refusal_reason: str | None
    delta: ComparisonDelta | None
    fail_to_pass: list[FlipSample]
    pass_to_fail: list[FlipSample]
    unchanged_passed: int
    unchanged_failed: int
    bucket_deltas: list[ComparisonBucketDelta]


class SampleFilters(BaseModel):
    """The `GET /samples` query parameters as one schema -- the value
    crossing the router-to-controller boundary
    (.cursor/rules/backend-layering.mdc).

    `rule` lands here in Phase 5, per Section 3.5: a sample *carries*
    the given rule id -- matching a bucket's own `n_instructions`
    denominator, not just its failures -- so combining it with the
    existing `passed=false` default is what Phase 6's "click a rule
    row" filters to the failing subset.

    `tag` lands here in Phase 8: exact membership in the sample's own
    `tags` list, so `tag=cosmetic` returns every sample carrying that
    tag -- clicking a chip in `DiagnosticsSummary` sets this the same
    way clicking a rule row sets `rule`.
    """

    passed: bool | None = None
    subset: str | None = None
    rule: str | None = None
    tag: str | None = None
    q: str | None = None
    limit: int = 50
    offset: int = 0
