"""Layer 5's single-sample lookup (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
Phase 7): finds one sample in an already-loaded diagnostics payload,
reads its full text from the reviews file by `index`, and builds its
rule checklist through the benchmark registry.

Sits beside `sample_query.py` and follows the same discipline: a pure
function over the plain dict `store.load_or_build` hands back, no DB
session, no benchmark branching of its own beyond the registry lookup
Section 3.4 already owns. The one thing this module adds over
`sample_query.py` is a second file read -- `evalscope_reviews.py` is
the only module allowed to know what a reviews line looks like
(docs/SCORE_DRILLDOWN_UI_PLAN.md Section 8), so the by-index text read
is delegated there rather than parsed here.
"""

import dataclasses
from pathlib import Path
from typing import Any

from app.schemas.diagnostics import DiagnosticsSampleDetail
from app.services.diagnostics import evalscope_reviews, registry
from app.services.diagnostics.records import RuleCheck, SampleRecord, SampleText


def find_sample_detail(
    payload: dict[str, Any], run_dir: Path, sample_key: str
) -> DiagnosticsSampleDetail | None:
    """`None` for an unknown `sample_key` -- the controller maps that
    to a 404, the same as `sample_query.find_sample` does for the
    plain list-row lookup.
    """
    sample_dict = _find_sample_dict(payload, sample_key)
    if sample_dict is None:
        return None

    sample_record = SampleRecord(**sample_dict)
    text = _read_text(payload, run_dir, sample_record)
    rules = _build_rules(payload["source"]["benchmark"], sample_record)

    detail_payload = {
        **sample_dict,
        "text": dataclasses.asdict(text) if text is not None else None,
        "rules": [dataclasses.asdict(rule) for rule in rules],
    }
    return DiagnosticsSampleDetail.model_validate(detail_payload)


def _find_sample_dict(payload: dict[str, Any], sample_key: str) -> dict[str, Any] | None:
    for sample in payload["samples"]:
        if sample["sample_key"] == sample_key:
            return sample
    return None


def _read_text(payload: dict[str, Any], run_dir: Path, sample: SampleRecord) -> SampleText | None:
    """`None` when this sample's subset can't be resolved to a reviews
    file, or that file no longer has a line at this sample's `index`
    -- both are "nothing usable to show", the same way
    `evalscope_reviews.read_sample_text` itself treats a missing index.
    """
    relative_file = _subset_file(payload, sample.subset)
    if relative_file is None:
        return None
    return evalscope_reviews.read_sample_text(run_dir / relative_file, sample.index)


def _subset_file(payload: dict[str, Any], subset_name: str) -> str | None:
    """The exact reviews file a subset's samples came from, recorded
    rather than reconstructed -- MMLU-Pro's real subset filenames
    contain spaces (Section 8's own trap), so this is the only safe
    way back from a subset name to its file.
    """
    for subset in payload["summary"]["subsets"]:
        if subset["name"] == subset_name:
            return subset["file"]
    return None


def _build_rules(benchmark: str, sample: SampleRecord) -> list[RuleCheck]:
    """`[]` for every benchmark without a checklist (Section 3.4) --
    the registry's `None` callable means exactly that, the same
    contract `store.py` already relies on for `build_buckets` and
    `build_instruction_level`.
    """
    facts = registry.facts_for(benchmark)
    if facts.build_rule_checklist is None:
        return []
    return facts.build_rule_checklist(sample)
