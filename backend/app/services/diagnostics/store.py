"""Path construction, write, load, and the lazy rebuild (Section 3.3 of
docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md) for the per-run diagnostics
file.

The one module that knows where this file lives -- Decision 2's note
says these run folders are meant to sync to S3 later, and keeping every
path computation here is what makes that day a change to this module
alone, with no S3 code added now.
"""

import dataclasses
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.services.diagnostics import evalscope_reviews, narrate, recheck, registry, tags
from app.services.diagnostics.records import DiagnosticsFile, DiagnosticsSource
from app.services.harness import runner as harness_runner

logger = logging.getLogger(__name__)

# Owned by this builder, not by the harness -- bumped by whichever later
# phase changes what gets written (Phase 5 to 2, Phase 8 to 3), which is
# what makes load_or_build's rebuild-when-stale rule self-migrating.
# Deliberately separate from recheck._RECHECK_VERSION: that one
# invalidates just the per-rule artifact, this one invalidates the
# whole diagnostics file, and conflating them would force every
# IFEval/IFBench run through a fresh container on every future bump
# (Phase 8's, to 3) even when nothing about the per-rule booleans
# changed.
SCHEMA_VERSION = 3


@dataclass
class DiagnosticsBuildSpec:
    """Everything the builder needs, as plain values -- no DB session.
    The worker has these on its already-loaded RunContext; the Phase 3
    lazy-rebuild path will read the same values off the run row and its
    joined standard/checkpoint. Keeping the builder session-free is what
    lets both call it.

    Deliberately excludes `standard.subsets`: subset files are
    discovered by globbing `reviews/`, because their on-disk names
    (MMLU-Pro's included) can't be safely reconstructed from that list,
    so passing it here would go unused.
    """

    eval_run_id: int
    benchmark: str
    task_name: str
    served_model_name: str
    metric_specs: list[dict[str, Any]]
    harness_image: str
    max_tokens: int | None


def diagnostics_path(eval_run_id: int, served_model_name: str, task_name: str) -> Path:
    """`{run_dir}/diagnostics/{served_model_name}/{task_name}.json` --
    pure path arithmetic, safe to call before the file exists, mirroring
    `harness_runner.run_directory`'s own contract.
    """
    run_dir = harness_runner.run_directory(eval_run_id)
    return _diagnostics_file_path(run_dir, served_model_name, task_name)


def _diagnostics_file_path(run_dir: Path, served_model_name: str, task_name: str) -> Path:
    return run_dir / "diagnostics" / served_model_name / f"{task_name}.json"


def build_and_write(spec: DiagnosticsBuildSpec, *, force_recheck: bool = False) -> dict[str, Any]:
    """Builds the diagnostics file for one run and writes it,
    unconditionally. The one code path both the worker's post-run hook
    and Phase 3's forced-rebuild endpoint call -- there is never a
    second way to produce this file.

    `force_recheck` only ever comes from the forced-rebuild endpoint
    (Section 3.5's `POST /diagnostics/rebuild`) -- `load_or_build`'s
    own call below always leaves it `False`, so a `schema_version`
    bump with no per-rule change (Phase 8's, to 3) rebuilds the file
    without re-running a container for every IFEval/IFBench run on
    disk.

    Returns the written file as a plain dict (the same shape
    `json.loads` would hand back), not a `DiagnosticsFile` -- nothing
    in this phase needs the dataclass back, and a plain dict is the
    same "receipt" discipline `parser.py`'s own `results_json` uses for
    a value that only ever gets read back, not recomputed on.
    """
    run_dir = harness_runner.run_directory(spec.eval_run_id)
    summary, samples, reviews_files = evalscope_reviews.build_diagnostics_summary(
        run_dir=run_dir,
        served_model_name=spec.served_model_name,
        task_name=spec.task_name,
        benchmark=spec.benchmark,
        metric_specs=spec.metric_specs,
        max_tokens=spec.max_tokens,
    )

    facts = registry.facts_for(spec.benchmark)
    if facts.supports_rule_recheck:
        # Mutates samples' benchmark_details["rule_results"] in place;
        # non-fatal on any failure -- every rule_results stays None,
        # exactly as if this call had never been made (Section 8's
        # "recheck failure must be non-fatal" trap).
        recheck.recheck_and_merge(
            eval_run_id=spec.eval_run_id,
            run_dir=run_dir,
            served_model_name=spec.served_model_name,
            task_name=spec.task_name,
            benchmark=spec.benchmark,
            harness_image=spec.harness_image,
            samples=samples,
            subsets=summary.subsets,
            force_recheck=force_recheck,
        )

    buckets = facts.build_buckets(samples) if facts.build_buckets is not None else []
    instruction_level = None
    if facts.build_instruction_level is not None:
        instruction_level = facts.build_instruction_level(samples)

    # Tags read rule_results, so this must run after recheck_and_merge
    # above -- otherwise every severity tag would be missing. Buckets
    # must already exist too: narrate.build_narrative's "weakest rule"
    # sentence reads the finest bucket level's own top row.
    tags.assign_tags(samples, benchmark=spec.benchmark, max_tokens=spec.max_tokens)
    tag_counts = tags.count_tags(samples)
    narrative = narrate.build_narrative(summary, buckets, tag_counts)

    # DiagnosticsSummary isn't frozen, but replacing rather than
    # mutating keeps evalscope_reviews.py's own return value untouched
    # -- only store.py, which owns the registry dispatch, assigns these
    # fields a real value.
    summary = dataclasses.replace(
        summary,
        instruction_level=instruction_level,
        tag_counts=tag_counts,
        narrative=narrative,
    )

    diagnostics_file = DiagnosticsFile(
        schema_version=SCHEMA_VERSION,
        generated_at=datetime.now(UTC).isoformat(),
        source=DiagnosticsSource(
            eval_run_id=spec.eval_run_id,
            benchmark=spec.benchmark,
            task_name=spec.task_name,
            served_model_name=spec.served_model_name,
            harness_image=spec.harness_image,
            reviews_files=reviews_files,
        ),
        summary=summary,
        buckets=buckets,
        samples=samples,
    )

    path = _diagnostics_file_path(run_dir, spec.served_model_name, spec.task_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = dataclasses.asdict(diagnostics_file)
    path.write_text(json.dumps(payload, indent=2))
    return payload


def load(eval_run_id: int, served_model_name: str, task_name: str) -> dict[str, Any] | None:
    """Reads the file if present and parseable. `None` on either a
    missing file or invalid JSON -- `load_or_build` treats both the
    same way: there is nothing usable to serve yet, so build it.
    """
    path = diagnostics_path(eval_run_id, served_model_name, task_name)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        logger.warning("diagnostics file at %s is not valid JSON; rebuilding", path)
        return None


def load_or_build(spec: DiagnosticsBuildSpec) -> dict[str, Any]:
    """Section 3.3's lazy rebuild, exactly: read the file if it exists;
    rebuild it if it's missing, unparseable, or older than this
    builder's own `SCHEMA_VERSION`; return the result either way. This
    is what lets the run folders already on disk serve real data with
    no backfill script and no migration.
    """
    existing = load(spec.eval_run_id, spec.served_model_name, spec.task_name)
    if existing is not None and existing.get("schema_version", 0) >= SCHEMA_VERSION:
        return existing
    return build_and_write(spec)
