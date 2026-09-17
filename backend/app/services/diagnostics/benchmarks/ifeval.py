"""IFEval's and IFBench's buckets and instruction-level reconciliation
(docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 5). Both benchmarks
share this module -- same checker family, same review metadata shape,
same four metrics -- rather than each getting its own near-duplicate.

Everything here reads `sample.scores` and `sample.benchmark_details`
only; neither is opaque at this layer the way it is to
`store.py`/`buckets.py`, because *this* is the one module Section 3.2
grants permission to look inside them.
"""

import statistics
from typing import Any

from app.services.diagnostics import buckets
from app.services.diagnostics.benchmarks import ifeval_descriptions
from app.services.diagnostics.records import (
    Bucket,
    InstructionLevelSummary,
    RuleCheck,
    SampleRecord,
)

# The harness's own macro-averaged instruction-level metric -- each
# sample's own pass ratio (e.g. 0.5 for "1 of 2 instructions
# followed"), averaged across samples. This is what
# `docs/SCORE_DRILLDOWN_UI_PLAN.md` Section 4 ("Layer 3") calls out as
# legitimately different from the pooled (micro) view a bucket
# breakdown necessarily is -- 0.9104 vs 0.8981 on `run-13`.
_MACRO_METRIC_NAME = "inst_level_strict"


def build_buckets(samples: list[SampleRecord]) -> list[Bucket]:
    """Family buckets first, then rule buckets, in one array -- Phase
    6 renders two tables from this one field. Both levels are the
    same micro counting primitive over the same instructions; only
    `group_key` differs.
    """
    family_buckets = buckets.instruction_buckets(samples, level="family", group_key=_rule_family)
    rule_buckets = buckets.instruction_buckets(samples, level="rule", group_key=_rule_id)
    return [*family_buckets, *rule_buckets]


def _rule_family(rule_id: str) -> str:
    return rule_id.split(":")[0]


def _rule_id(rule_id: str) -> str:
    return rule_id


def build_instruction_level(samples: list[SampleRecord]) -> InstructionLevelSummary | None:
    """`None` only if no sample carries `inst_level_strict` at all --
    never happens for a real IFEval/IFBench run, but a benchmark
    module must not assume the metric it was written for is actually
    present (an empty run directory, or a standard whose `metrics`
    list was edited, are both real ways for that to be false).
    """
    macro_values = [
        sample.scores[_MACRO_METRIC_NAME]
        for sample in samples
        if _MACRO_METRIC_NAME in sample.scores
    ]
    if not macro_values:
        return None
    macro_value = statistics.fmean(macro_values)

    micro_passed, micro_total = _pooled_from_stored_scores(samples)
    micro_value = (micro_passed / micro_total) if micro_total else 0.0

    return InstructionLevelSummary(
        macro_metric_name=_MACRO_METRIC_NAME,
        macro_value=macro_value,
        micro_value=micro_value,
        micro_passed=micro_passed,
        micro_total=micro_total,
        recheck_passed=_pooled_recheck_passed(samples),
    )


def _pooled_from_stored_scores(samples: list[SampleRecord]) -> tuple[int, int]:
    """The micro (pooled) instruction-level count, derived from the
    *stored* per-sample macro ratio rather than the recheck -- the
    harness stays authoritative even for a number this module only
    computes to explain a gap against it. `micro_passed` is
    `sum(inst_level_strict * len(instruction_id_list))`, rounded once
    at the end rather than per sample -- verified to reproduce
    `run-13`'s 749 of 834 exactly.
    """
    total = 0
    passed_float = 0.0
    for sample in samples:
        instruction_id_list = sample.benchmark_details.get("instruction_id_list") or []
        n = len(instruction_id_list)
        if n == 0 or _MACRO_METRIC_NAME not in sample.scores:
            continue
        total += n
        passed_float += sample.scores[_MACRO_METRIC_NAME] * n
    return round(passed_float), total


def _pooled_recheck_passed(samples: list[SampleRecord]) -> int | None:
    """The recheck's own pooled pass count -- what `build_buckets`'s
    rule-level rows actually sum to. `None` when the recheck never
    ran for any sample; per decision 4 this is expected to differ from
    `_pooled_from_stored_scores`'s `micro_passed` by a couple of
    instructions (751 vs 749 on `run-13`), and that gap is never
    reconciled.
    """
    passed = 0
    any_known = False
    for sample in samples:
        rule_results = sample.benchmark_details.get("rule_results")
        if rule_results is None:
            continue
        any_known = True
        passed += sum(1 for rule in rule_results if rule["strict"])
    return passed if any_known else None


def build_rule_checklist(sample: SampleRecord) -> list[RuleCheck]:
    """Layer 5's per-rule tick list for one sample
    (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 7) -- one row per
    instruction, in `instruction_id_list`'s own order.

    Zips `instruction_id_list`, `kwargs`, and `rule_results`
    positionally rather than keying by rule id: a rule id can repeat
    on one sample with different `kwargs` and different outcomes
    (`run-13` key 1040 carries `change_case:capital_word_frequency`
    twice -- "less than 10" passes, "at least 1" fails -- and keying by
    id would silently collapse the two rows into one).
    """
    instruction_id_list = sample.benchmark_details.get("instruction_id_list") or []
    kwargs_list = sample.benchmark_details.get("kwargs") or []
    rule_results = sample.benchmark_details.get("rule_results")

    checklist: list[RuleCheck] = []
    for position, rule_id in enumerate(instruction_id_list):
        kwargs = kwargs_list[position] if position < len(kwargs_list) else {}
        strict = rule_results[position]["strict"] if rule_results is not None else None
        loose = rule_results[position]["loose"] if rule_results is not None else None
        checklist.append(
            RuleCheck(
                rule_id=rule_id,
                description=ifeval_descriptions.describe_rule(rule_id, kwargs),
                strict=strict,
                loose=loose,
            )
        )
    return checklist


# Failure taxonomy tags (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 6;
# docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 8). Shared with
# IFBench, which carries no `language:response_language` rule and so
# never emits `wrong_language`.
_LANGUAGE_RULE_ID = "language:response_language"


def build_tags(sample: SampleRecord) -> list[str]:
    """Severity first, then cosmetic, then wrong_language -- so a
    row's first tag is always its severity when one exists. Severity
    and wrong_language both need `rule_results`; when the recheck
    never ran (or failed), `rule_results` is `None` and both are
    skipped rather than guessed at ("without it, emit neither" --
    Phase 8's own wording for severity tags, extended here to
    wrong_language since it depends on the same recheck output.
    `cosmetic` needs only `scores`, so it is unaffected.
    """
    rule_results = sample.benchmark_details.get("rule_results")
    tags: list[str] = []

    severity = _severity_tag(rule_results) if rule_results is not None else None
    if severity is not None:
        tags.append(severity)

    if sample.scores.get("prompt_level_loose") == 1.0:
        tags.append("cosmetic")

    if rule_results is not None and _rule_failed_strict(rule_results, _LANGUAGE_RULE_ID):
        tags.append("wrong_language")

    return tags


def _severity_tag(rule_results: list[dict[str, Any]]) -> str | None:
    """`None` for an empty `rule_results` list -- never observed on a
    real run (every IFEval/IFBench question carries at least one
    rule), but a benchmark module must not assume that of a benchmark
    it was written for (registry.py's own discipline).

    `recheck_disagrees` covers the couple of samples per run where the
    recheck finds every rule passing on a sample the harness scored as
    failed (`run-13` keys 1122 and 1129, the random-letter samples
    from docs/SCORE_DRILLDOWN_UI_PLAN.md Section 6) -- tagged rather
    than silently dropped, so the severity partition still accounts
    for every failure, but named to make no causal claim. Never
    `checker_quirk`: decision 4 forbids reporting the known upstream
    defect by name.
    """
    if not rule_results:
        return None
    strict_results = [rule["strict"] for rule in rule_results]
    if not any(strict_results):
        return "complete_miss"
    if all(strict_results):
        return "recheck_disagrees"
    return "near_miss"


def _rule_failed_strict(rule_results: list[dict[str, Any]], rule_id: str) -> bool:
    return any(rule["rule_id"] == rule_id and not rule["strict"] for rule in rule_results)
