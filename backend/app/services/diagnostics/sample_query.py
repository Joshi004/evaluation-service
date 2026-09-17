"""Filtering, paging, and single-sample lookup over an already-loaded
diagnostics file (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Section
3.5). Pure functions over the plain dict `store.load_or_build`/
`build_and_write` hand back -- no DB session, no file I/O, so the
controller's one loaded payload can serve both `GET /samples` and
`GET /samples/{sample_key}` with no second read.
"""

from typing import Any

from app.schemas.diagnostics import DiagnosticsSample, SampleFilters, SamplePage


def filter_samples(payload: dict[str, Any], filters: SampleFilters) -> SamplePage:
    """`total` is the count after filtering, before paging (Section
    3.5) -- a caller pages through exactly the rows `total` promises,
    not a filtered-then-repaged count that shifts underneath it.
    """
    matches = [sample for sample in payload["samples"] if _matches(sample, filters)]
    page = matches[filters.offset : filters.offset + filters.limit]
    return SamplePage(
        total=len(matches),
        items=[DiagnosticsSample.model_validate(sample) for sample in page],
    )


def find_sample(payload: dict[str, Any], sample_key: str) -> DiagnosticsSample | None:
    """`sample_key` is always a string (Section 3.4), so an exact match
    is enough -- no int/str coercion for GSM8K/GPQA-Diamond's
    index-fallback keys.
    """
    for sample in payload["samples"]:
        if sample["sample_key"] == sample_key:
            return DiagnosticsSample.model_validate(sample)
    return None


def _matches(sample: dict[str, Any], filters: SampleFilters) -> bool:
    if filters.passed is not None and sample["passed"] != filters.passed:
        return False
    if filters.subset is not None and sample["subset"] != filters.subset:
        return False
    if filters.rule is not None and not _carries_rule(sample, filters.rule):
        return False
    if filters.tag is not None and filters.tag not in sample["tags"]:
        return False
    if filters.q is not None:
        haystack = f"{sample['input_preview']} {sample['output_preview']}".lower()
        if filters.q.lower() not in haystack:
            return False
    return True


def _carries_rule(sample: dict[str, Any], rule_id: str) -> bool:
    """Whether this sample was graded against `rule_id` at all --
    matching a bucket's own `n_instructions` denominator (Section
    3.5), not just its failures.

    The one place this module reaches inside `benchmark_details`,
    which every other shared layer treats as opaque (Section 3.2):
    Section 3.5 names `rule` as a shared query parameter, so the
    filter has to live here, not in a benchmark module. A benchmark
    with no `instruction_id_list` at all (MMLU-Pro, GSM8K,
    GPQA-Diamond) safely never matches, rather than raising.
    """
    instruction_id_list = sample["benchmark_details"].get("instruction_id_list") or []
    return rule_id in instruction_id_list
