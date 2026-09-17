"""Adapter: EvalScope's `reviews/`+`predictions/` JSONL pair for one
run's one task, in; normalized `SampleRecord`s and their summary, out.

No DB session and no knowledge of where the resulting file gets
written -- that discipline belongs to `store.py`, one level up. Matches
`app/services/harness/parser.py`'s own style: files in, dataclasses
out. If a second harness ever arrives, it gets its own module beside
this one; nothing above this layer should know an EvalScope review line
exists (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 8).
"""

import json
import logging
import statistics
from pathlib import Path
from typing import Any

from app.services.diagnostics import registry
from app.services.diagnostics.records import (
    DiagnosticsSummary,
    HealthSummary,
    LatencySeconds,
    MetricSummary,
    OutputTokens,
    SampleRecord,
    SampleText,
    SubsetSummary,
)
from app.services.harness.parser import is_truncated_record, uses_stop_reason

logger = logging.getLogger(__name__)

_PREVIEW_LENGTH = 300


def build_diagnostics_summary(
    run_dir: Path,
    served_model_name: str,
    task_name: str,
    benchmark: str,
    metric_specs: list[dict[str, Any]],
    max_tokens: int | None,
) -> tuple[DiagnosticsSummary, list[SampleRecord], list[str]]:
    """Reads every `reviews/{served_model_name}/{task_name}_*.jsonl`
    subset file and its paired predictions file, and returns the
    normalized samples plus the summary computed over them.
    `reviews_files` (the third element) is relative to `run_dir`, for
    `DiagnosticsSource.reviews_files`.
    """
    primary_spec = next(spec for spec in metric_specs if spec["is_primary"])
    facts = registry.facts_for(benchmark)

    samples, subsets, reviews_files, matched_predictions = _build_samples_and_subsets(
        run_dir, served_model_name, task_name, facts, primary_spec["name"]
    )

    health = _build_health(samples, matched_predictions, max_tokens)
    metrics = _metric_summaries(metric_specs, samples)
    passed = sum(1 for sample in samples if sample.passed)

    summary = DiagnosticsSummary(
        n_samples=len(samples),
        primary_metric_name=primary_spec["name"],
        primary_metric_display_name=primary_spec["display_name"],
        passed=passed,
        failed=len(samples) - passed,
        metrics=metrics,
        health=health,
        subsets=subsets,
        # Filled in by store.py, after this function returns, from the
        # benchmark registry's build_instruction_level -- this module
        # stays the shared, benchmark-agnostic adapter (Section 8 of
        # docs/SCORE_DRILLDOWN_UI_PLAN.md) and never computes a
        # macro/micro reconciliation that only IFEval/IFBench have.
        instruction_level=None,
        # Filled in by store.py too, from tags.py's assign_tags/
        # count_tags and narrate.py's build_narrative -- both need the
        # buckets this function's caller computes afterward, so
        # there's nothing this adapter could fill in itself.
        tag_counts=[],
        narrative=[],
    )
    return summary, samples, reviews_files


def read_sample_text(reviews_path: Path, index: int) -> SampleText | None:
    """One sample's full, untruncated text, read straight from its
    reviews file by `index` (Phase 7 of
    docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md) -- never stored in the
    diagnostics file (Section 3.2).

    Stops at the first matching line rather than parsing every line
    into a dict first: a full IFEval reviews file is already several
    megabytes and MMLU-Pro's can be tens of, but Layer 5 only ever
    needs one sample per request. `None` when no line in the file
    carries this index -- `sample_detail.py` treats that as a 404, the
    same as an unknown `sample_key`.
    """
    for line in reviews_path.read_text().split("\n"):
        if not line.strip():
            continue
        review = json.loads(line)
        if review["index"] != index:
            continue
        return _sample_text_from_review(review)
    return None


def _sample_text_from_review(review: dict[str, Any]) -> SampleText:
    score = review["sample_score"]["score"]
    messages = review.get("messages")
    prompt_text, _ = _content_parts(_first_user_message_content(messages))
    answer_text, reasoning_text = _content_parts(_last_assistant_message_content(messages))
    return SampleText(
        prompt=prompt_text,
        answer=answer_text,
        reasoning=reasoning_text,
        target=review.get("target") or "",
        extracted_prediction=score.get("extracted_prediction") or "",
        explanation=score.get("explanation"),
    )


def _build_samples_and_subsets(
    run_dir: Path,
    served_model_name: str,
    task_name: str,
    facts: registry.BenchmarkFacts,
    primary_metric_name: str,
) -> tuple[list[SampleRecord], list[SubsetSummary], list[str], list[dict[str, Any]]]:
    samples: list[SampleRecord] = []
    subsets: list[SubsetSummary] = []
    reviews_files: list[str] = []
    matched_predictions: list[dict[str, Any]] = []

    reviews_dir = run_dir / "reviews" / served_model_name
    # Glob {task_name}_*.jsonl, never construct a filename: MMLU-Pro's
    # real subset files include "mmlu_pro_computer science.jsonl" (a
    # space), and a reviews directory can hold a different task's
    # leftovers -- runs/run-6 and runs/run-7 both carry a stale
    # ifeval_default.jsonl alongside their real task's file. Scoping the
    # glob to this task_name is what keeps that leftover out.
    for reviews_path in sorted(reviews_dir.glob(f"{task_name}_*.jsonl")):
        subset = reviews_path.stem[len(task_name) + 1 :]
        reviews_relative = str(reviews_path.relative_to(run_dir))
        reviews_files.append(reviews_relative)

        predictions_path = run_dir / "predictions" / served_model_name / reviews_path.name
        # Keyed per subset file, never in one dict shared across
        # subsets: EvalScope's own `index` restarts at 0 in every
        # MMLU-Pro subset file, so a single global {index: record} dict
        # would silently collapse this benchmark's 2,800 samples onto
        # 200 (verified against a real run's 14 subset files).
        predictions_by_index = _index_predictions(predictions_path)

        subset_n_samples = 0
        subset_passed = 0
        for review in _read_jsonl(reviews_path):
            prediction = predictions_by_index.get(review["index"])
            sample = _to_sample_record(review, prediction, subset, facts, primary_metric_name)
            samples.append(sample)
            subset_n_samples += 1
            subset_passed += sample.passed
            if prediction is not None:
                matched_predictions.append(prediction)

        subsets.append(
            SubsetSummary(
                name=subset,
                n_samples=subset_n_samples,
                passed=subset_passed,
                file=reviews_relative,
            )
        )

    return samples, subsets, reviews_files, matched_predictions


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    """Split on a literal "\\n", not `str.splitlines()` -- a real
    MMLU-Pro record contains U+0085, which `splitlines()` treats as a
    line break and cuts in half (documented in full in
    app/services/harness/parser.py; confirmed again here against the
    same file).
    """
    return [json.loads(line) for line in path.read_text().split("\n") if line.strip()]


def _index_predictions(predictions_path: Path) -> dict[int, dict[str, Any]]:
    """One subset file's predictions, keyed by `index`. The caller
    iterates reviews, not this dict, because a predictions file can
    carry more lines than its paired reviews file, or duplicate
    indexes, when a run directory holds output left over from more than
    one attempt (verified: 556 prediction lines against 541 review
    lines, 15 of them duplicate indexes, on one such run in this repo's
    fixtures). A later duplicate wins; there is no ordering guarantee
    worth trusting over the other.
    """
    if not predictions_path.exists():
        return {}
    return {record["index"]: record for record in _read_jsonl(predictions_path)}


def _to_sample_record(
    review: dict[str, Any],
    prediction: dict[str, Any] | None,
    subset: str,
    facts: registry.BenchmarkFacts,
    primary_metric_name: str,
) -> SampleRecord:
    sample_score = review["sample_score"]
    score = sample_score["score"]
    scores: dict[str, float] = score["value"]
    sample_metadata = sample_score.get("sample_metadata") or {}

    sample_key = (
        str(sample_metadata[facts.sample_key_field])
        if facts.sample_key_field is not None and facts.sample_key_field in sample_metadata
        else str(review["index"])
    )

    benchmark_details: dict[str, Any] = {
        field_name: sample_metadata.get(field_name) for field_name in facts.detail_fields
    }
    benchmark_details["rule_results"] = None  # filled in by Phase 5's recheck

    # The review's own `score.prediction` is the answer text already --
    # identical to the assistant message's `type: "text"` part, but
    # without needing to know whether that message's `content` is a
    # bare string or a list of parts (see _content_parts below). Taking
    # both previews from files already open for this sample keeps the
    # prediction record needed only for latency, tokens, stop_reason and
    # has_reasoning.
    output_text = score.get("prediction") or ""
    input_text, _ = _content_parts(_first_user_message_content(review.get("messages")))

    model_output = (prediction or {}).get("model_output") or {}
    choices = model_output.get("choices") or []
    # An empty choices list is a request-level error (parser.py's own
    # comment on this), not a missing stop_reason to guess at.
    stop_reason = choices[0].get("stop_reason") if choices else None
    message_content = choices[0]["message"].get("content") if choices else None
    _, reasoning_text = _content_parts(message_content)
    has_reasoning = bool(reasoning_text)
    perf_metrics = model_output.get("perf_metrics") or {}

    return SampleRecord(
        sample_key=sample_key,
        index=review["index"],
        subset=subset,
        passed=scores.get(primary_metric_name) == 1.0,
        scores=scores,
        input_preview=input_text[:_PREVIEW_LENGTH],
        output_preview=output_text[:_PREVIEW_LENGTH],
        target=review.get("target") or "",
        tokens_in=perf_metrics.get("input_tokens"),
        tokens_out=perf_metrics.get("output_tokens"),
        latency_seconds=perf_metrics.get("latency"),
        stop_reason=stop_reason,
        has_reasoning=has_reasoning,
        tags=[],
        benchmark_details=benchmark_details,
    )


def _first_user_message_content(messages: list[dict[str, Any]] | None) -> Any:
    for message in messages or []:
        if message.get("role") == "user":
            return message.get("content")
    return None


def _last_assistant_message_content(messages: list[dict[str, Any]] | None) -> Any:
    """The most recent assistant turn's `content`. Every benchmark in
    the catalog today is single-turn (exactly one assistant message),
    but this walks to the last one rather than assuming that, since
    nothing about the review envelope itself rules out more.
    """
    content = None
    for message in messages or []:
        if message.get("role") == "assistant":
            content = message.get("content")
    return content


def _content_parts(content: Any) -> tuple[str, str]:
    """Answer text and reasoning text for one message's `content`, in
    whichever shape EvalScope wrote it: a bare string on some runs (this
    repo's MMLU-Pro fixtures, and one IFEval run), a list of typed parts
    on others (every other run checked). A string carries no reasoning
    block. A part list's answer is its `type: "text"` part; the
    thinking block is its `type: "reasoning"` part, under a `reasoning`
    key rather than `text` -- docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
    Section 8 documents the list case but not the plain-string one,
    which a real run also produces and which silently scores every
    sample as reasoning-free text if assumed to always be a list.

    Returns `("", "")` reasoning as an empty string rather than `None`
    so callers (this module's own `has_reasoning`, and Phase 7's
    `read_sample_text`) can treat "no reasoning" uniformly as falsy
    without a second `is None` check.
    """
    if isinstance(content, str):
        return content, ""
    if isinstance(content, list):
        text = "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        )
        reasoning = "".join(
            part.get("reasoning") or ""
            for part in content
            if isinstance(part, dict) and part.get("type") == "reasoning"
        )
        return text, reasoning
    return "", ""


def _build_health(
    samples: list[SampleRecord],
    matched_predictions: list[dict[str, Any]],
    max_tokens: int | None,
) -> HealthSummary:
    # A blank preview means a blank full answer: the longest leading
    # run of whitespace seen before real content, across every review
    # in this repo's fixtures, is 3 characters -- nowhere near the
    # 300-character preview length, so truncation can never hide a
    # non-blank answer behind what looks like an empty one.
    empty_answers = sum(1 for sample in samples if not sample.output_preview.strip())
    errored_requests = sum(
        1 for record in matched_predictions if not (record.get("model_output") or {}).get("choices")
    )

    # Reuses parser.py's own fallback logic rather than re-deriving it:
    # one definition of "truncated" for both the run-level rate
    # (compute_truncation_rate) and this per-run health count.
    use_token_count_fallback = not uses_stop_reason(matched_predictions)
    truncated = sum(
        is_truncated_record(record, max_tokens, use_token_count_fallback)
        for record in matched_predictions
    )

    latency_seconds, output_tokens = _latency_and_tokens(samples)
    return HealthSummary(
        truncated=truncated,
        empty_answers=empty_answers,
        errored_requests=errored_requests,
        latency_seconds=latency_seconds,
        output_tokens=output_tokens,
    )


def _latency_and_tokens(
    samples: list[SampleRecord],
) -> tuple[LatencySeconds | None, OutputTokens | None]:
    """`None` for either field when no sample had a matching prediction
    record at all -- guards the block's own presence rather than
    assuming it, the same discipline report_summary.py uses for
    `results_json["perf_metrics"]`.
    """
    latencies = sorted(
        sample.latency_seconds for sample in samples if sample.latency_seconds is not None
    )
    output_token_counts = [sample.tokens_out for sample in samples if sample.tokens_out is not None]

    latency_seconds = (
        LatencySeconds(
            mean=statistics.fmean(latencies),
            p50=_percentile(latencies, 0.50),
            p90=_percentile(latencies, 0.90),
            p99=_percentile(latencies, 0.99),
            max=latencies[-1],
        )
        if latencies
        else None
    )
    output_tokens = (
        OutputTokens(
            mean=statistics.fmean(output_token_counts),
            max=max(output_token_counts),
            total=sum(output_token_counts),
        )
        if output_token_counts
        else None
    )
    return latency_seconds, output_tokens


def _percentile(sorted_values: list[float], fraction: float) -> float:
    """Linear interpolation between order statistics, at `(n-1) *
    fraction` -- reproduces `results_json["perf_metrics"]["summary"]`'s
    own percentiles exactly (verified against a real run: mean, p50,
    p90, p99 and max all match to the stored value's own precision).
    That match is what lets the lazy-rebuild path report the same
    health numbers Phase 1's report_summary.py already reads from the
    harness report, computed here straight from the per-sample records
    instead.
    """
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (len(sorted_values) - 1) * fraction
    lower_index = int(rank)
    upper_index = min(lower_index + 1, len(sorted_values) - 1)
    if lower_index == upper_index:
        return sorted_values[lower_index]
    lower_value = sorted_values[lower_index]
    upper_value = sorted_values[upper_index]
    return lower_value + (rank - lower_index) * (upper_value - lower_value)


def _metric_summaries(
    metric_specs: list[dict[str, Any]], samples: list[SampleRecord]
) -> list[MetricSummary]:
    """One entry per `standard.metrics` spec, in the same primary-first
    order the YAML declares them -- not just the primary metric, so
    Phase 6's "the per-rule numbers do not reconcile with the headline"
    copy has both the macro figure (here, `passed=None`) and the micro
    one to explain the gap with.
    """
    summaries: list[MetricSummary] = []
    for spec in metric_specs:
        name = spec["name"]
        values = [sample.scores[name] for sample in samples if name in sample.scores]
        if not values:
            continue
        is_binary_pass_rate = all(value in (0.0, 1.0) for value in values)
        passed = sum(1 for value in values if value == 1.0) if is_binary_pass_rate else None
        summaries.append(
            MetricSummary(
                name=name,
                display_name=spec["display_name"],
                value=statistics.fmean(values),
                n_samples=len(values),
                passed=passed,
            )
        )
    return summaries
