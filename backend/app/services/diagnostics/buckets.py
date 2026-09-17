"""Layer 3's shared bucket computation (docs/SCORE_DRILLDOWN_UI_PLAN.md
Section 4; docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 5) -- two
counting primitives plus one sort. The per-benchmark part is only ever
*what defines a group*: `benchmarks/ifeval.py` supplies a `group_key`
function for `instruction_buckets`, and `mmlu_pro`'s registry entry
calls `sample_buckets_by_detail_field` directly with no benchmark
module of its own.

Deliberately real attribution, not "blame every rule on a failed
sample" -- docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4 measures that
shortcut against `run-13`'s real numbers and it under-counts every
family while completely hiding the one rule that never passes.
"""

from collections import defaultdict
from collections.abc import Callable

from app.services.diagnostics.records import Bucket, SampleRecord


def instruction_buckets(
    samples: list[SampleRecord], level: str, group_key: Callable[[str], str]
) -> list[Bucket]:
    """Pools every sample's own instructions -- its recheck-derived
    `rule_results` when present, its bare `instruction_id_list`
    otherwise -- into `group_key`-defined buckets. This is the shared
    **micro** counting primitive both IFEval's rule table and its
    family table are built from; the caller decides which by passing a
    different `group_key`.

    A bucket's `passed`/`pass_rate` stay `None` when none of its
    instructions came with a known outcome -- a failed recheck leaves
    `rule_results` `None` on every sample uniformly, so every bucket
    from a single build is either all-known or all-unknown in
    practice, never a mix. The counting below tracks the general case
    per instruction anyway, rather than assuming that.
    """
    totals: dict[str, int] = defaultdict(int)
    known_totals: dict[str, int] = defaultdict(int)
    known_passed: dict[str, int] = defaultdict(int)

    for sample in samples:
        for rule_id, is_pass in _instruction_entries(sample):
            key = group_key(rule_id)
            totals[key] += 1
            if is_pass is not None:
                known_totals[key] += 1
                if is_pass:
                    known_passed[key] += 1

    result = [
        Bucket(
            name=name,
            level=level,
            n_instructions=totals[name],
            passed=known_passed[name] if known_totals[name] else None,
            pass_rate=(known_passed[name] / known_totals[name]) if known_totals[name] else None,
        )
        for name in totals
    ]
    return sort_buckets(result)


def _instruction_entries(sample: SampleRecord) -> list[tuple[str, bool | None]]:
    """One `(rule_id, strict_pass_or_none)` pair per instruction on
    this sample. `strict_pass_or_none` is `None` when the recheck
    never ran for this sample -- the instruction is known to exist
    (from `instruction_id_list`) but not known to have passed or
    failed.
    """
    rule_results = sample.benchmark_details.get("rule_results")
    if rule_results is not None:
        return [(rule["rule_id"], rule["strict"]) for rule in rule_results]
    instruction_id_list = sample.benchmark_details.get("instruction_id_list") or []
    return [(rule_id, None) for rule_id in instruction_id_list]


def sample_buckets_by_detail_field(
    samples: list[SampleRecord], level: str, field: str
) -> list[Bucket]:
    """A sample-level bucket, keyed on one `benchmark_details` field --
    MMLU-Pro's subject grouping needs no recheck and no per-benchmark
    module because of it. Reuses `Bucket`'s own shape: `n_instructions`
    counts samples in the group here, not individual rules, the same
    way `passed` already means "this sample's own primary metric was
    1.0" everywhere else in this file. A sample whose detail field is
    missing is skipped rather than grouped under `None`.
    """
    totals: dict[str, int] = defaultdict(int)
    passed: dict[str, int] = defaultdict(int)

    for sample in samples:
        name = sample.benchmark_details.get(field)
        if name is None:
            continue
        totals[name] += 1
        if sample.passed:
            passed[name] += 1

    result = [
        Bucket(
            name=name,
            level=level,
            n_instructions=totals[name],
            passed=passed[name],
            pass_rate=(passed[name] / totals[name]) if totals[name] else None,
        )
        for name in totals
    ]
    return sort_buckets(result)


def sort_buckets(buckets: list[Bucket]) -> list[Bucket]:
    """Descending by instructions lost, then ascending pass rate, then
    ascending name -- ranked by how much it cost you, not the
    alphabet (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4, "Layer 3").
    Byte-identical on every rebuild, which matters from Phase 8
    onward.

    Buckets with no known outcome sort after every bucket that has
    one, by instruction count then name -- a state today's pipeline
    never actually mixes within one list (see `instruction_buckets`),
    ordered defensively rather than left unspecified.
    """

    def sort_key(bucket: Bucket) -> tuple[bool, float, float, str]:
        if bucket.passed is None:
            return (True, float(-bucket.n_instructions), 0.0, bucket.name)
        lost = bucket.n_instructions - bucket.passed
        pass_rate = bucket.pass_rate if bucket.pass_rate is not None else 0.0
        return (False, float(-lost), pass_rate, bucket.name)

    return sorted(buckets, key=sort_key)
