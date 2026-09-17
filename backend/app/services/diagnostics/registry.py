"""Section 3.4's benchmark registry. Phase 2 built the first two
columns (`sample_key_field`, `detail_fields`); Phase 5 added the three
Strategy columns for the recheck and buckets. Phase 7 adds the Layer 5
renderer column: `build_rule_checklist`, `store.py`'s dispatch point
for whether a sample gets a per-rule tick list at all.
"""

from collections.abc import Callable
from dataclasses import dataclass

from app.services.diagnostics import buckets
from app.services.diagnostics.benchmarks import ifeval
from app.services.diagnostics.records import (
    Bucket,
    InstructionLevelSummary,
    RuleCheck,
    SampleRecord,
)


@dataclass(frozen=True)
class BenchmarkFacts:
    """`sample_key_field` names a key inside a review's own
    `sample_metadata`; `None` means the benchmark has no stable id and
    `sample_key` falls back to `str(index)` (GSM8K, GPQA-Diamond --
    stable only because each dataset is pinned by the harness image
    tag; a future dataset change would silently mis-join compare mode,
    which is acceptable now per Section 8 of
    docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md).

    `detail_fields` are copied verbatim from `sample_metadata` into
    `benchmark_details`, which every shared layer treats as opaque.

    `supports_rule_recheck` gates whether `store.py` calls
    `recheck.recheck_and_merge` at all -- `False` here means a
    benchmark's samples never spawn a container, not just that the
    result would be empty.

    `build_buckets`/`build_instruction_level` are `None` for a
    benchmark with no breakdown (GSM8K, GPQA-Diamond) or no
    instruction-level metrics (MMLU-Pro, which has `build_buckets` but
    not the other) -- `store.py` treats a `None` callable as "produce
    nothing for this", never as a benchmark to special-case.

    `build_rule_checklist` is `None` for every benchmark without a
    per-rule tick list (Phase 7) -- `sample_detail.py` treats a `None`
    callable the same way `store.py` treats the two above: "this
    benchmark has no checklist", not a case to special-case by name.

    `build_tags` is `None` for every benchmark without its own failure
    tags (Phase 8) -- `tags.py`'s `assign_tags` treats that the same
    way: "no benchmark-specific tags", not a case to special-case by
    name. The two shared signals (`truncated`, `empty`) are computed
    by `tags.py` itself and applied regardless of this field.
    """

    sample_key_field: str | None
    detail_fields: tuple[str, ...]
    supports_rule_recheck: bool
    build_buckets: Callable[[list[SampleRecord]], list[Bucket]] | None
    build_instruction_level: Callable[[list[SampleRecord]], InstructionLevelSummary | None] | None
    build_rule_checklist: Callable[[SampleRecord], list[RuleCheck]] | None
    build_tags: Callable[[SampleRecord], list[str]] | None


def _mmlu_pro_buckets(samples: list[SampleRecord]) -> list[Bucket]:
    """Subject grouping needs no recheck and no per-benchmark module
    of its own -- it's the shared sample-level primitive, called
    directly with MMLU-Pro's one detail field.
    """
    return buckets.sample_buckets_by_detail_field(samples, level="subject", field="subject")


_REGISTRY: dict[str, BenchmarkFacts] = {
    "ifeval": BenchmarkFacts(
        sample_key_field="key",
        detail_fields=("instruction_id_list", "kwargs"),
        supports_rule_recheck=True,
        build_buckets=ifeval.build_buckets,
        build_instruction_level=ifeval.build_instruction_level,
        build_rule_checklist=ifeval.build_rule_checklist,
        build_tags=ifeval.build_tags,
    ),
    "ifbench": BenchmarkFacts(
        sample_key_field="key",
        detail_fields=("instruction_id_list", "kwargs"),
        supports_rule_recheck=True,
        build_buckets=ifeval.build_buckets,
        build_instruction_level=ifeval.build_instruction_level,
        build_rule_checklist=ifeval.build_rule_checklist,
        build_tags=ifeval.build_tags,
    ),
    "mmlu_pro": BenchmarkFacts(
        sample_key_field="question_id",
        detail_fields=("subject",),
        supports_rule_recheck=False,
        build_buckets=_mmlu_pro_buckets,
        build_instruction_level=None,
        build_rule_checklist=None,
        build_tags=None,
    ),
    "gpqa_diamond": BenchmarkFacts(
        sample_key_field=None,
        detail_fields=("correct_answer",),
        supports_rule_recheck=False,
        build_buckets=None,
        build_instruction_level=None,
        build_rule_checklist=None,
        build_tags=None,
    ),
    "gsm8k": BenchmarkFacts(
        sample_key_field=None,
        detail_fields=("reasoning",),
        supports_rule_recheck=False,
        build_buckets=None,
        build_instruction_level=None,
        build_rule_checklist=None,
        build_tags=None,
    ),
}

# An unknown benchmark falls back to str(index), copies nothing into
# benchmark_details, never rechecks, and produces no buckets or
# checklist, per Section 3.4's own contract -- never raise just
# because this table hasn't caught up with a new benchmark yet.
_UNKNOWN_BENCHMARK = BenchmarkFacts(
    sample_key_field=None,
    detail_fields=(),
    supports_rule_recheck=False,
    build_buckets=None,
    build_instruction_level=None,
    build_rule_checklist=None,
    build_tags=None,
)


def facts_for(benchmark: str) -> BenchmarkFacts:
    return _REGISTRY.get(benchmark, _UNKNOWN_BENCHMARK)
