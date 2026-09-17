"""Phase 9's join: two runs' diagnostics files -> flip lists, bucket
deltas, and a significance-tested score delta
(docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 9).

Pure function over two already-loaded diagnostics payloads -- no DB
session, no file I/O, same discipline as
app/services/diagnostics/sample_query.py. The controller loads each
side through the existing `_load_payload` (itself `store.load_or_build`
under the hood), so this module only ever sees the plain dict that
produces.
"""

import math
from typing import Any

from app.schemas.diagnostics import (
    ComparisonBucketDelta,
    ComparisonDelta,
    ComparisonOverlap,
    ComparisonSide,
    FlipSample,
    RunComparison,
)
from app.services.diagnostics.report_summary import wilson_interval

# Below this fraction of the smaller run's own sample count, the two
# runs barely overlap and any diff would mostly be comparing disjoint
# question sets -- docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4: "a
# misleading diff is worse than a refusal."
_MINIMUM_OVERLAP_RATIO = 0.5


def compare_payloads(left: dict[str, Any], right: dict[str, Any]) -> RunComparison:
    """Joins on `sample_key` (Section 3.2 guarantees this is a string
    unique within one run's own diagnostics file -- verified 541/541 on
    `run-13` and 2,800/2,800 across MMLU-Pro `run-4`'s 14 subset files,
    since `question_id` is globally unique there).

    A benchmark with no stable id (GSM8K, GPQA-Diamond) falls back to
    `str(index)` per Section 3.4 -- comparing two such runs joins on
    index position, not on any real identity. That is an accepted
    limitation carried over from Phase 2, not something this join
    fixes.
    """
    left_side = _build_side(left)
    right_side = _build_side(right)

    left_samples_by_key: dict[str, dict[str, Any]] = {
        sample["sample_key"]: sample for sample in left["samples"]
    }
    right_samples_by_key: dict[str, dict[str, Any]] = {
        sample["sample_key"]: sample for sample in right["samples"]
    }
    shared_keys = left_samples_by_key.keys() & right_samples_by_key.keys()
    overlap = ComparisonOverlap(
        n_shared=len(shared_keys),
        left_only=len(left_samples_by_key) - len(shared_keys),
        right_only=len(right_samples_by_key) - len(shared_keys),
    )

    refusal_reason = _refusal_reason(left, right, overlap)
    if refusal_reason is not None:
        return RunComparison(
            left=left_side,
            right=right_side,
            overlap=overlap,
            comparable=False,
            refusal_reason=refusal_reason,
            delta=None,
            fail_to_pass=[],
            pass_to_fail=[],
            unchanged_passed=0,
            unchanged_failed=0,
            bucket_deltas=[],
        )

    fail_to_pass, pass_to_fail, unchanged_passed, unchanged_failed = _classify_samples(
        shared_keys,
        left_samples_by_key,
        right_samples_by_key,
        left_side.primary_metric_name,
        right_side.primary_metric_name,
    )

    return RunComparison(
        left=left_side,
        right=right_side,
        overlap=overlap,
        comparable=True,
        refusal_reason=None,
        delta=_build_delta(left_side, right_side),
        fail_to_pass=fail_to_pass,
        pass_to_fail=pass_to_fail,
        unchanged_passed=unchanged_passed,
        unchanged_failed=unchanged_failed,
        bucket_deltas=_build_bucket_deltas(left.get("buckets", []), right.get("buckets", [])),
    )


def _refusal_reason(
    left: dict[str, Any], right: dict[str, Any], overlap: ComparisonOverlap
) -> str | None:
    """Checked in this order -- benchmark mismatch first, because it is
    the one that looks the most like a real comparison right up until
    you read the numbers. `run-12` (ifbench) shares 36 sample keys with
    `run-13` (ifeval): enough to pass an overlap-ratio check on its own
    if this check didn't run first, which is exactly the misleading
    diff the plan document refuses.
    """
    left_benchmark = left["source"]["benchmark"]
    right_benchmark = right["source"]["benchmark"]
    if left_benchmark != right_benchmark:
        return (
            f"Run {left['source']['eval_run_id']} is {left_benchmark} and run "
            f"{right['source']['eval_run_id']} is {right_benchmark} -- comparing "
            "different benchmarks would not be a meaningful diff."
        )

    if overlap.n_shared == 0:
        return "These two runs share no sample keys, so there is nothing to compare."

    smaller_n_samples = min(left["summary"]["n_samples"], right["summary"]["n_samples"])
    if smaller_n_samples and overlap.n_shared / smaller_n_samples < _MINIMUM_OVERLAP_RATIO:
        return (
            f"Only {overlap.n_shared} of {smaller_n_samples} samples overlap -- too little "
            "shared ground for a meaningful diff."
        )

    return None


def _classify_samples(
    shared_keys: set[str],
    left_samples_by_key: dict[str, dict[str, Any]],
    right_samples_by_key: dict[str, dict[str, Any]],
    left_primary_metric_name: str,
    right_primary_metric_name: str,
) -> tuple[list[FlipSample], list[FlipSample], int, int]:
    """One pass over the shared keys, splitting into the two flip lists
    Section 4's "Sideways" section asks for plus the two unchanged
    counts -- `unchanged_failed` is what a caller reconciles against
    each run's own `summary.failed` (`unchanged_failed + len(pass_to_fail)`
    should equal the left run's `failed`, and `unchanged_failed +
    len(fail_to_pass)` the right run's).
    """
    fail_to_pass: list[FlipSample] = []
    pass_to_fail: list[FlipSample] = []
    unchanged_passed = 0
    unchanged_failed = 0

    for key in shared_keys:
        left_sample = left_samples_by_key[key]
        right_sample = right_samples_by_key[key]
        left_passed = left_sample["passed"]
        right_passed = right_sample["passed"]

        if not left_passed and right_passed:
            fail_to_pass.append(
                _build_flip_sample(
                    key,
                    left_sample,
                    right_sample,
                    left_primary_metric_name,
                    right_primary_metric_name,
                )
            )
        elif left_passed and not right_passed:
            pass_to_fail.append(
                _build_flip_sample(
                    key,
                    left_sample,
                    right_sample,
                    left_primary_metric_name,
                    right_primary_metric_name,
                )
            )
        elif left_passed:
            unchanged_passed += 1
        else:
            unchanged_failed += 1

    # `shared_keys` is a set -- iteration order is otherwise arbitrary,
    # and a response should be byte-stable across two calls with the
    # same two runs.
    fail_to_pass.sort(key=lambda sample: sample.sample_key)
    pass_to_fail.sort(key=lambda sample: sample.sample_key)

    return fail_to_pass, pass_to_fail, unchanged_passed, unchanged_failed


def _build_flip_sample(
    sample_key: str,
    left_sample: dict[str, Any],
    right_sample: dict[str, Any],
    left_primary_metric_name: str,
    right_primary_metric_name: str,
) -> FlipSample:
    return FlipSample(
        sample_key=sample_key,
        subset=left_sample["subset"],
        input_preview=left_sample["input_preview"],
        left_output_preview=left_sample["output_preview"],
        right_output_preview=right_sample["output_preview"],
        left_score=left_sample["scores"].get(left_primary_metric_name),
        right_score=right_sample["scores"].get(right_primary_metric_name),
    )


def _build_side(payload: dict[str, Any]) -> ComparisonSide:
    """Reads the primary metric's value out of `summary.metrics` by
    name, falling back to the summary's own `passed / n_samples` if
    that entry is somehow absent -- the same number for a binary
    primary metric, just computed without depending on the metrics
    list being complete.
    """
    source = payload["source"]
    summary = payload["summary"]
    primary_metric_name = summary["primary_metric_name"]
    n_samples = summary["n_samples"]
    passed = summary["passed"]
    failed = summary["failed"]

    metric = next(
        (entry for entry in summary["metrics"] if entry["name"] == primary_metric_name), None
    )
    value = metric["value"] if metric is not None else (passed / n_samples if n_samples else 0.0)
    confidence_interval = wilson_interval(value, n_samples) if n_samples else None

    return ComparisonSide(
        eval_run_id=source["eval_run_id"],
        benchmark=source["benchmark"],
        served_model_name=source["served_model_name"],
        primary_metric_name=primary_metric_name,
        primary_metric_display_name=summary["primary_metric_display_name"],
        value=value,
        n_samples=n_samples,
        passed=passed,
        failed=failed,
        confidence_interval=confidence_interval,
    )


def _build_delta(left_side: ComparisonSide, right_side: ComparisonSide) -> ComparisonDelta | None:
    """`None` only when a side has no confidence interval at all (an
    empty run, `n_samples == 0`) -- there is no meaningful "inside the
    interval" test to run against nothing.
    """
    if left_side.confidence_interval is None or right_side.confidence_interval is None:
        return None

    left_half_width = (
        left_side.confidence_interval.upper - left_side.confidence_interval.lower
    ) / 2
    right_half_width = (
        right_side.confidence_interval.upper - right_side.confidence_interval.lower
    ) / 2
    combined_half_width = math.sqrt(left_half_width**2 + right_half_width**2)
    value = right_side.value - left_side.value

    return ComparisonDelta(
        value=value,
        combined_half_width=combined_half_width,
        is_significant=abs(value) > combined_half_width,
    )


def _build_bucket_deltas(
    left_buckets: list[dict[str, Any]], right_buckets: list[dict[str, Any]]
) -> list[ComparisonBucketDelta]:
    """A full outer join on `(level, name)`. Only meaningful when both
    sides actually have buckets (Phase 5's IFEval/IFBench/MMLU-Pro) --
    GSM8K/GPQA-Diamond's `[]` on either side means "no breakdown for
    this benchmark", not zero buckets to diff, so this returns `[]`
    rather than a table with nothing in it.
    """
    if not left_buckets or not right_buckets:
        return []

    left_by_key = {(bucket["level"], bucket["name"]): bucket for bucket in left_buckets}
    right_by_key = {(bucket["level"], bucket["name"]): bucket for bucket in right_buckets}
    all_keys = left_by_key.keys() | right_by_key.keys()

    deltas = [
        _build_bucket_delta(level, name, left_by_key, right_by_key) for level, name in all_keys
    ]
    return sorted(deltas, key=_bucket_delta_sort_key)


def _build_bucket_delta(
    level: str,
    name: str,
    left_by_key: dict[tuple[str, str], dict[str, Any]],
    right_by_key: dict[tuple[str, str], dict[str, Any]],
) -> ComparisonBucketDelta:
    left_bucket = left_by_key.get((level, name))
    right_bucket = right_by_key.get((level, name))
    left_pass_rate = left_bucket["pass_rate"] if left_bucket else None
    right_pass_rate = right_bucket["pass_rate"] if right_bucket else None
    pass_rate_delta = (
        right_pass_rate - left_pass_rate
        if left_pass_rate is not None and right_pass_rate is not None
        else None
    )

    return ComparisonBucketDelta(
        name=name,
        level=level,
        left_n_instructions=left_bucket["n_instructions"] if left_bucket else None,
        left_passed=left_bucket["passed"] if left_bucket else None,
        left_pass_rate=left_pass_rate,
        right_n_instructions=right_bucket["n_instructions"] if right_bucket else None,
        right_passed=right_bucket["passed"] if right_bucket else None,
        right_pass_rate=right_pass_rate,
        pass_rate_delta=pass_rate_delta,
    )


def _bucket_delta_sort_key(bucket: ComparisonBucketDelta) -> tuple[bool, float, str, str]:
    """Descending by `abs(pass_rate_delta)` -- "what moved most" first,
    the same cost-first philosophy `buckets.sort_buckets` uses for a
    single run's own table, just not the same function: that one ranks
    absolute cost within one run, this ranks a two-run delta, and nulls
    (a bucket only one side produced) sort last rather than first or
    by an arbitrary zero.
    """
    if bucket.pass_rate_delta is None:
        return (True, 0.0, bucket.level, bucket.name)
    return (False, -abs(bucket.pass_rate_delta), bucket.level, bucket.name)
