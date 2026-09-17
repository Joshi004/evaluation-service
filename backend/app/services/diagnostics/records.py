"""Dataclasses for the per-run diagnostics file (Section 3.2 of
docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md).

Plain dataclasses, not Pydantic models -- any schema in `app/schemas/`
is explicitly out of scope for Phase 2, and this mirrors
`app/services/harness/parser.py`'s own discipline: files in, dataclasses
out, no DB session. `store.py` turns a `DiagnosticsFile` into JSON with
`dataclasses.asdict`.

`RuleCheck` and `SampleText` (Phase 7) are the exception to "written to
the file": they are passed between `app/services/diagnostics/` modules
for a single-sample request and never appear in `DiagnosticsFile`
itself -- Section 3.2 is explicit that full text stays out of the
diagnostics file, read from the reviews file on demand instead.
"""

from dataclasses import dataclass
from typing import Any


@dataclass
class SampleRecord:
    """One normalized sample, shared across every benchmark -- Section
    3.2's per-sample shape, exactly. `benchmark_details` is opaque to
    every shared layer; only a benchmark module and the Layer 5
    renderer (both later phases) look inside it. It always carries a
    `rule_results` key, `None` until Phase 5's recheck fills it in.
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


@dataclass
class MetricSummary:
    """One of `standard.metrics`, recomputed from the sample records
    rather than read from `results_json` -- the lazy-rebuild path (Phase
    3) has no `eval_run` row's report to read it from, only the files on
    disk this module also reads.

    `passed` is `None` unless every sample's value for this metric is
    exactly 0.0 or 1.0. That is true for IFEval/IFBench's prompt-level
    metrics (a real per-sample pass/fail) and false for their
    instruction-level ones (each sample's own macro-averaged pass
    ratio, e.g. 0.5 for "1 of 2 instructions followed") -- the same
    distinction `MetricPerformance` documents in
    app/schemas/diagnostics.py for the Phase 1 health band.
    """

    name: str
    display_name: str
    value: float
    n_samples: int
    passed: int | None


@dataclass
class SubsetSummary:
    """One subset's counts, plus the exact reviews file they came from.

    `file` is recorded rather than reconstructed: MMLU-Pro's real subset
    filenames contain spaces ("mmlu_pro_computer science.jsonl"), and
    its `index` restarts at 0 in every subset file, so a future by-index
    lookup (Phase 7's full-text read) needs the exact file, not a name
    it rebuilds from `name`.
    """

    name: str
    n_samples: int
    passed: int
    file: str


@dataclass
class LatencySeconds:
    mean: float
    p50: float
    p90: float
    p99: float
    max: float


@dataclass
class OutputTokens:
    mean: float
    max: float
    total: int


@dataclass
class HealthSummary:
    """Run-level red flags that make a score untrustworthy regardless
    of benchmark. `latency_seconds`/`output_tokens` are `None` when no
    sample had a matching prediction record at all -- an empty run
    directory must not render as a health band full of zeros.
    """

    truncated: int
    empty_answers: int
    errored_requests: int
    latency_seconds: LatencySeconds | None
    output_tokens: OutputTokens | None


@dataclass
class InstructionLevelSummary:
    """Reconciles the harness's own macro-averaged instruction-level
    score against the pooled (micro) view a bucket breakdown
    necessarily is (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4, "Layer
    3"; docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 5). All of
    `macro_value`/`micro_value`/`micro_passed`/`micro_total` are
    derived from the *stored* per-sample scores alone, so the harness
    stays authoritative even though this block exists to explain a gap
    against it -- verified on `run-13`: macro 0.9104, micro 749/834 =
    0.8981.

    `recheck_passed` is the recheck's own pooled count instead -- what
    the bucket rows actually sum to -- and is `None` when the recheck
    never ran. Expect it to differ from `micro_passed` by a couple of
    instructions (751 vs 749 on `run-13`): decision 4's two
    random-letter samples, never reconciled.
    """

    macro_metric_name: str
    macro_value: float
    micro_value: float
    micro_passed: int
    micro_total: int
    recheck_passed: int | None


@dataclass
class Bucket:
    """One row of Layer 3's breakdown table (docs/SCORE_DRILLDOWN_UI_PLAN.md
    Section 4) -- `level` distinguishes which table a row belongs to
    ("family" or "rule" for IFEval/IFBench; "subject" for MMLU-Pro).

    `passed`/`pass_rate` are `None` when the only thing known is which
    instructions exist in this bucket, not how many passed -- a failed
    recheck still produces buckets from `instruction_id_list` alone,
    with per-rule detail marked unavailable rather than guessed at
    (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 5's own rejection
    of "blame every rule on a failed sample": docs/SCORE_DRILLDOWN_UI_PLAN.md
    Section 4 measures that shortcut against the real numbers and it
    is simply wrong, not just imprecise).
    """

    name: str
    level: str
    n_instructions: int
    passed: int | None
    pass_rate: float | None


@dataclass
class TagCount:
    """One row of the tag chip row (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
    Phase 8) -- how many samples carry this tag. Every tag Phase 8
    defines is only ever assigned to a failing sample
    (`tags.assign_tags`), so in practice this is always a failure
    count, never a count over the whole run. `count_tags` sorts these
    descending by count then ascending by tag name, so the chip row
    order is byte-stable across rebuilds.
    """

    tag: str
    n_samples: int


@dataclass
class DiagnosticsSummary:
    """`passed`/`failed` are the primary metric's own pass count --
    Section 3.2's note: derived from `scores[primary_metric_name] ==
    1.0` per sample, never from the harness's `main_score_name` (`null`
    for GSM8K, GPQA-Diamond and MMLU-Pro).
    """

    n_samples: int
    primary_metric_name: str
    primary_metric_display_name: str
    passed: int
    failed: int
    metrics: list[MetricSummary]
    health: HealthSummary
    subsets: list[SubsetSummary]
    # `None` for a benchmark with no instruction-level metrics at all
    # (GSM8K, GPQA-Diamond, MMLU-Pro) -- only IFEval/IFBench's shape
    # has a macro/micro distinction to reconcile.
    instruction_level: InstructionLevelSummary | None
    # Phase 8: how many failing samples carry each tag, across the
    # whole run. `GET /diagnostics` returns no samples array, so this
    # is the only way the page can show a tag filter's own counts
    # before a single sample is fetched.
    tag_counts: list[TagCount]
    # Phase 8's deterministic written summary -- one sentence per list
    # entry, already in display order. `[]` never happens once a
    # Phase 8 build has run: a clean run still gets its own single
    # "All N samples passed." sentence.
    narrative: list[str]


@dataclass
class DiagnosticsSource:
    eval_run_id: int
    benchmark: str
    task_name: str
    served_model_name: str
    harness_image: str
    reviews_files: list[str]


@dataclass
class DiagnosticsFile:
    """The whole file, Section 3.2. Before Phase 5, `buckets` was
    always `[]` and every sample's `benchmark_details["rule_results"]`
    was always `None` -- this phase fills both in (for the benchmarks
    that have them) and bumps `schema_version` to 2.
    """

    schema_version: int
    generated_at: str
    source: DiagnosticsSource
    summary: DiagnosticsSummary
    buckets: list[Bucket]
    samples: list[SampleRecord]


@dataclass
class RuleCheck:
    """One row of Layer 5's per-rule checklist
    (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4, "Layer 5"; Phase 7).

    Built positionally from a sample's `instruction_id_list`, `kwargs`,
    and `rule_results` -- never keyed by `rule_id`, because the same
    rule id can appear twice on one sample with different `kwargs` and
    different outcomes (`run-13` key 1040 carries
    `change_case:capital_word_frequency` twice: "less than 10" passes,
    "at least 1" fails).

    `strict`/`loose` are `None` when the sample's own `rule_results`
    is `None` -- a recheck that never ran, or failed. The row still
    renders, with the rule and its English description, just without
    ticks (Phase 7: "When `rule_results` is null, show the scores and
    the rule list without ticks").
    """

    rule_id: str
    description: str
    strict: bool | None
    loose: bool | None


@dataclass
class SampleText:
    """The full, untruncated text for one sample -- read from the
    reviews file on demand, by `index`, and never written into the
    diagnostics file itself (Section 3.2: "Full prompt and answer text
    is read from the reviews file on demand, by index, in Phase 7").

    `reasoning` is `""` when the sample's answer has no thinking block
    -- either because thinking was off for that request, or because
    `content` was a bare string rather than a list of parts (every
    MMLU-Pro review; `evalscope_reviews._content_parts` documents the
    same split). `explanation` mirrors `score.explanation`, which is
    `null` for every benchmark in the catalog today but is kept here
    for the benchmark whose grader is an LLM judge, per
    docs/SCORE_DRILLDOWN_UI_PLAN.md Section 8.
    """

    prompt: str
    answer: str
    reasoning: str
    target: str
    extracted_prediction: str
    explanation: str | None
