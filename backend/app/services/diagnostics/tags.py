"""The failure taxonomy (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 6;
docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 8): a list of tags per
failing sample, not a single category, because the causes overlap -- a
sample can be both a near miss and cosmetic. Only failing samples
carry tags; a passing sample's `tags` stays `[]`, exactly as
`evalscope_reviews.py` created it.

Two shared signals (`truncated`, `empty`) apply to every benchmark and
are computed here, over the already-normalized `SampleRecord`s, so
they agree with `HealthSummary.truncated`/`empty_answers` by
construction rather than by coincidence. Everything else needs to look
inside `benchmark_details`, which is opaque to this module the same
way it is to `buckets.py` -- so it is a benchmark's own `build_tags`
hook, dispatched through the registry, the same Strategy shape
`build_buckets`/`build_instruction_level`/`build_rule_checklist`
already use.

Deliberately excludes a `checker_quirk` tag and the
whitespace-sensitivity probe -- decision 4 of
docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md says that analysis is being
done by hand.
"""

from collections import Counter

from app.services.diagnostics import registry
from app.services.diagnostics.records import SampleRecord, TagCount


def assign_tags(samples: list[SampleRecord], *, benchmark: str, max_tokens: int | None) -> None:
    """Mutates every sample's `tags` in place. Tags failing samples
    only -- "each failing sample carries tags" (Phase 8) -- so a
    passing sample is left untouched.

    `benchmark_tags` come first, then the shared signals, and that
    order is never re-sorted: a row's first tag is always its severity
    when one exists, and the file stays byte-identical across
    rebuilds of the same run.
    """
    build_tags = registry.facts_for(benchmark).build_tags
    use_token_count_fallback = _use_token_count_fallback(samples)

    for sample in samples:
        if sample.passed:
            continue
        benchmark_tags = build_tags(sample) if build_tags is not None else []
        shared_tags = _shared_tags(
            sample, use_token_count_fallback=use_token_count_fallback, max_tokens=max_tokens
        )
        sample.tags = [*benchmark_tags, *shared_tags]


def count_tags(samples: list[SampleRecord]) -> list[TagCount]:
    """How many samples carry each tag, sorted by count descending
    then tag name ascending -- deterministic chip order, and the only
    way `GET /diagnostics` (which returns no samples array) can show a
    tag filter's own counts.
    """
    counts = Counter(tag for sample in samples for tag in sample.tags)
    return [
        TagCount(tag=tag, n_samples=count)
        for tag, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def _shared_tags(
    sample: SampleRecord, *, use_token_count_fallback: bool, max_tokens: int | None
) -> list[str]:
    tags: list[str] = []
    if _is_truncated(
        sample, use_token_count_fallback=use_token_count_fallback, max_tokens=max_tokens
    ):
        tags.append("truncated")
    if not sample.output_preview.strip():
        tags.append("empty")
    return tags


def _is_truncated(
    sample: SampleRecord, *, use_token_count_fallback: bool, max_tokens: int | None
) -> bool:
    """Reproduces `harness.parser.is_truncated_record`'s two branches
    over the already-normalized per-sample fields, so a failing
    sample's own `truncated` tag agrees with `HealthSummary.truncated`'s
    run-wide count by construction rather than by a second
    reimplementation of the same rule.
    """
    if use_token_count_fallback:
        return sample.tokens_out == max_tokens
    return sample.stop_reason == "max_tokens"


def _use_token_count_fallback(samples: list[SampleRecord]) -> bool:
    """Mirrors `harness.parser.uses_stop_reason`: true only when *no*
    sample in the run carries a `stop_reason` at all. Computed over
    every sample, not just failures, because whether a run's
    predictions carry a `stop_reason` is a property of the run, not of
    one sample.
    """
    return not any(sample.stop_reason is not None for sample in samples)
