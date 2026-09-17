"""Harness entrypoint for Phase 5's per-rule recheck
(docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md): re-runs IFEval's/IFBench's
own checkers against a run's saved answers and writes the per-rule
strict/loose result the harness averages away before anything is
written to disk.

Mounted read-only into a short-lived container from the *standard's
own* harness image and run with `--entrypoint python`
(app/services/diagnostics/recheck.py builds that invocation) -- never
baked into the image, so the checkers stay pinned to the exact version
that produced the original score. This is the only place in the whole
system that imports evalscope's benchmark internals directly; the
backend process itself never does (decision D2 of
docs/IMPLEMENTATION_PHASES.md).
"""

import importlib
import json
import random
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

# The mount point every harness invocation in this repo agrees on --
# runner.py's CONTAINER_WORK_DIR and task_config.py's work_dir both
# use this same "/work" convention. Request paths arrive container-
# absolute (matching harness_task_config.json's own convention); this
# is what turns one back into the run-relative path
# DiagnosticsSource.reviews_files / SubsetSummary.file both use.
_WORK_DIR = "/work"

# benchmark -> the module whose test_instruction_following_strict /
# test_instruction_following_loose / InputExample this script calls.
# Both were confirmed, by reading the pinned commit, to expose an
# identical dataclass/function shape: ifeval's own module doubles as
# its instructions registry, ifbench's is evaluation_lib.py.
_CHECKER_MODULES = {
    "ifeval": "evalscope.benchmarks.ifeval.utils",
    "ifbench": "evalscope.benchmarks.ifbench.evaluation_lib",
}


def _load_reviews(path: Path) -> list[dict[str, Any]]:
    """Split on a literal "\\n", not `str.splitlines()` -- a real
    MMLU-Pro record contains U+0085, which `splitlines()` treats as a
    line break and cuts in half (documented in
    app/services/harness/parser.py, and again in
    app/services/diagnostics/evalscope_reviews.py). IFEval and IFBench
    reviews are the same file format, so the same trap applies here.
    """
    return [json.loads(line) for line in path.read_text().split("\n") if line.strip()]


def _relative_to_work_dir(container_path: str) -> str:
    """The inverse of how the request path was built -- request paths
    arrive container-absolute, and the result line's own "file" key
    needs to match SubsetSummary.file / DiagnosticsSource.reviews_files,
    both of which are run-relative.
    """
    prefix = f"{_WORK_DIR}/"
    if not container_path.startswith(prefix):
        raise ValueError(f"expected a path under {_WORK_DIR}, got {container_path!r}")
    return container_path[len(prefix) :]


def _recheck_file(reviews_path: str, checker_module: ModuleType, body_lines: list[str]) -> None:
    relative_path = _relative_to_work_dir(reviews_path)
    for review in _load_reviews(Path(reviews_path)):
        metadata = review["sample_score"]["sample_metadata"] or {}
        instruction_id_list = metadata["instruction_id_list"]
        # The adapter's own match_score scores `filtered_prediction`
        # (score.extracted_prediction), not score.prediction -- the
        # two are identical for every IFEval/IFBench sample checked,
        # but this is the field the adapter actually grades.
        response = review["sample_score"]["score"].get("extracted_prediction") or ""

        inp = checker_module.InputExample(
            key=metadata["key"],
            instruction_id_list=instruction_id_list,
            prompt=metadata["prompt"],
            kwargs=metadata["kwargs"],
        )
        # Strict first, always. IFBench's own strict pass mutates
        # inp.kwargs in place to drop None values, and its loose pass
        # relies on that having already happened -- confirmed against
        # the pinned commit's evaluation_lib.py, and process_results
        # itself calls them in this same order. IFEval's two passes
        # don't share state, so the order is harmless there too.
        strict = checker_module.test_instruction_following_strict(inp, response)
        loose = checker_module.test_instruction_following_loose(inp, response)

        rules = [
            {"rule_id": rule_id, "strict": is_strict, "loose": is_loose}
            for rule_id, is_strict, is_loose in zip(
                instruction_id_list,
                strict.follow_instruction_list,
                loose.follow_instruction_list,
                strict=True,
            )
        ]
        body_lines.append(
            json.dumps({"file": relative_path, "index": review["index"], "rules": rules})
        )


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {sys.argv[0]} <request.json>")

    request = json.loads(Path(sys.argv[1]).read_text())
    benchmark = request["benchmark"]
    module_name = _CHECKER_MODULES.get(benchmark)
    if module_name is None:
        raise SystemExit(f"no recheck checkers registered for benchmark {benchmark!r}")
    checker_module = importlib.import_module(module_name)

    # Two samples per real IFEval run hit an upstream fallback that
    # picks a random letter (docs/SCORE_DRILLDOWN_UI_PLAN.md Section
    # 6) -- without a fixed seed the same run rechecks to a different
    # number on every call.
    random.seed(request["random_seed"])

    body_lines: list[str] = []
    for reviews_path in request["reviews_files"]:
        _recheck_file(reviews_path, checker_module, body_lines)

    header = json.dumps(
        {
            "recheck_version": request["recheck_version"],
            "benchmark": benchmark,
            "random_seed": request["random_seed"],
            "n_samples": len(body_lines),
        }
    )

    output_path = Path(request["output_file"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join([header, *body_lines]) + "\n")


if __name__ == "__main__":
    main()
