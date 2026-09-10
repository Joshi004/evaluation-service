"""Turns a finished harness run's output tree into `results_json`, one
`ParsedMetric` per `standard.metrics` entry, and a `truncation_rate`.

Pure functions only: files in, dataclasses out, no DB session and no
EvalScope import (see the package docstring). That's what lets a
stored report be re-parsed by a script instead of a re-run.

The report schema here is EvalScope's v2 (`schema_version: 2`),
confirmed against a real `reports/<model_tag>/<task>.json` on 8 Sep --
not the nested `report["raw"][task]["metrics"][harness_key]` shape
docs/IMPLEMENTATION_PHASES.md's Phase 4 snippet describes. The real
top level is a flat `metrics` list; each entry carries an `identity`
dict (`name` + `aggregation`, e.g. "prompt_level_strict" + "mean") in
place of a single combined key, plus `score` and `num` directly on the
entry. `_harness_key` below reconstructs the "name:aggregation" string
so `standard.metrics[i]["harness_key"]` still matches something.
"""

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.models import SamplingProfile, Standard

logger = logging.getLogger(__name__)


@dataclass
class ParsedMetric:
    """One row's worth of data for the `metric` table (models/metric.py)
    -- everything except `eval_run_id`, which the caller has and this
    module never needs to.
    """

    name: str
    value: float
    n_samples: int | None
    is_primary: bool


@dataclass
class ParsedReport:
    results_json: dict[str, Any]
    metrics: list[ParsedMetric]


def parse_report(run_dir: Path, standard: Standard, served_model_name: str) -> ParsedReport:
    """Reads `reports/<served_model_name>/<standard.task_name>.json`.

    `served_model_name` must be the exact value passed as the
    `TaskConfig.model` this run used (Trap T3) -- never reconstructed
    from a checkpoint path, because that is not what EvalScope names
    the directory after.
    """
    report_path = run_dir / "reports" / served_model_name / f"{standard.task_name}.json"
    report = json.loads(report_path.read_text())

    # The whole file, verbatim, goes to results_json: it's the receipt
    # that lets a wrong parse be re-parsed instead of re-run.
    metrics = [_extract_metric(report, metric_spec) for metric_spec in standard.metrics]
    return ParsedReport(results_json=report, metrics=metrics)


def _extract_metric(report: dict[str, Any], metric_spec: dict[str, Any]) -> ParsedMetric:
    harness_key = metric_spec["harness_key"]
    report_metrics = report.get("metrics", [])

    matching_entry = None
    for report_metric in report_metrics:
        if _harness_key(report_metric) == harness_key:
            matching_entry = report_metric
            break

    if matching_entry is None:
        # A mismatch belongs in the standard YAML, not papered over here
        # -- so the error names both the key we wanted and the keys
        # the report actually had.
        found_keys = [_harness_key(report_metric) for report_metric in report_metrics]
        raise KeyError(
            f"standard metric harness_key {harness_key!r} not found in report; "
            f"report has: {found_keys}"
        )

    return ParsedMetric(
        name=metric_spec["name"],
        value=_normalize_score(matching_entry["score"]),
        n_samples=matching_entry["num"],
        is_primary=metric_spec["is_primary"],
    )


def _harness_key(report_metric: dict[str, Any]) -> str:
    """Renders "name:aggregation", e.g. "prompt_level_strict:mean" --
    the same string standard.metrics stores in harness_key, reconstructed
    from a report metric's `identity` block. task_config.py's
    `_metric_names` splits this same convention apart for the opposite
    reason (building the request rather than reading the response).
    """
    identity = report_metric["identity"]
    return f"{identity['name']}:{identity['aggregation']}"


def _normalize_score(score: float) -> float:
    """Every `metric.value` on one 0..1 scale, per models/metric.py's
    own contract -- inert for EvalScope's scores, which are already
    fractions (e.g. 0.7412), and the step that will reconcile another
    harness's 0..100 scale later.
    """
    return score / 100 if score > 1.0 else score


def compute_truncation_rate(
    run_dir: Path,
    standard: Standard,
    sampling_profile: SamplingProfile,
    served_model_name: str,
) -> float | None:
    """The fraction of `predictions/<served_model_name>/<task>_default.jsonl`
    records that hit `sampling_profile.max_tokens` before finishing.
    `max_tokens` moved to `sampling_profile` in Phase 3 (it depends on
    the checkpoint, not the benchmark), so this now needs both rows:
    `standard` for the task_name that names the predictions file,
    `sampling_profile` for the token budget itself.

    Returns None if the predictions file is missing or empty (a
    harness failure) rather than 0.0 -- a run that produced no data
    and a run with no truncation must never look the same, because
    this is the column that stops the first real number from silently
    measuring our token budget (see Milestone 1's 12-of-12 case in
    docs/IMPLEMENTATION_PHASES.md).
    """
    predictions_path = (
        run_dir / "predictions" / served_model_name / f"{standard.task_name}_default.jsonl"
    )
    if not predictions_path.exists():
        return None

    records = [
        json.loads(line) for line in predictions_path.read_text().splitlines() if line.strip()
    ]
    if not records:
        return None

    # Confirmed against a real predictions file (8 Sep): the field is
    # `model_output.choices[0].stop_reason`, value "max_tokens" -- not
    # `finish_reason` at either the choice or the top level, which is
    # what the phase doc guessed. Kept as a fallback rather than the
    # only path, so a future EvalScope schema change degrades to a
    # documented approximation instead of a silent, wrong 0.0.
    use_token_count_fallback = not any(_stop_reason(record) is not None for record in records)
    if use_token_count_fallback:
        logger.warning(
            "no prediction record had model_output.choices[0].stop_reason; "
            "falling back to output_tokens == sampling_profile.max_tokens. "
            "model_output keys seen: %s",
            sorted(records[0].get("model_output", {}).keys()),
        )

    truncated_count = 0
    for record in records:
        if use_token_count_fallback:
            hit_max_tokens = _output_tokens(record) == sampling_profile.max_tokens
        else:
            hit_max_tokens = _stop_reason(record) == "max_tokens"
        if hit_max_tokens:
            truncated_count += 1

    return truncated_count / len(records)


def _stop_reason(record: dict[str, Any]) -> str | None:
    choices = record.get("model_output", {}).get("choices", [])
    if not choices:
        # An empty choices list is a request-level error (ignore_errors:
        # True keeps the record instead of dropping it), not a
        # truncation -- distinct from, and never counted as, hitting
        # max_tokens.
        return None
    return choices[0].get("stop_reason")


def _output_tokens(record: dict[str, Any]) -> int | None:
    return record.get("model_output", {}).get("usage", {}).get("output_tokens")
