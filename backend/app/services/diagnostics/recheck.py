"""Spawns the per-rule recheck container and merges its output into
already-built `SampleRecord`s (Phase 5 of
docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md).

Mounts `harness/evalscope` read-only into a short-lived container from
the *standard's own* harness image -- never rebuilds it, because
`standard.framework_image` is a hashed field and a new tag would mint
new standard rows and split every leaderboard column. Follows
`runner.py`'s own host-path split exactly: `run_dir` is this process's
own view of the run folder, and `harness_runner.host_run_directory`
is what the bind mount actually needs, because the container is
created by the *host* Docker daemon, which never sees this process's
mount namespace.

Synchronous, deliberately, unlike `runner.py`'s streaming
`asyncio.create_subprocess_exec`: this pass takes a couple of seconds
against a small file, not hours against an open-ended generation call,
so there is nothing to stream and no reason to hold the event loop --
every caller of `build_and_write` already runs it inside a worker
thread.

Non-fatal by design, all the way through: any failure here -- a
missing image, a Docker socket that isn't reachable, a non-zero exit,
an unparseable artifact -- logs and returns, leaving every sample's
`rule_results` at whatever it already was (`None`, on a first build).
`store.build_and_write` still writes the diagnostics file either way.
"""

import json
import logging
import subprocess
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.services.diagnostics.records import SampleRecord, SubsetSummary
from app.services.harness import runner as harness_runner

logger = logging.getLogger(__name__)

# Bumped only if recheck_instructions.py's own output shape changes --
# deliberately separate from DiagnosticsFile.schema_version, because a
# bump here invalidates just the cached artifact. Without that split,
# every future schema_version bump (Phase 8's, to 3) would force every
# IFEval/IFBench run back through a container it doesn't actually need.
_RECHECK_VERSION = 1

# Arbitrary but fixed. Two samples per real IFEval run hit an upstream
# fallback that picks a random letter (docs/SCORE_DRILLDOWN_UI_PLAN.md
# Section 6); a fixed seed is what makes two rebuilds of the same run
# agree with *each other*. It does not, and is not meant to, make them
# agree with the harness's own (unseeded) stored score for those two
# samples -- decision 4 expects that disagreement and never reconciles
# it.
_RANDOM_SEED = 0

# Generous relative to the measured cost (1-3s: container start plus
# importing evalscope's checkers) -- enough to survive a cold image
# pull or a loaded host without hanging a request indefinitely.
_RECHECK_TIMEOUT_SECONDS = 120


def recheck_and_merge(
    *,
    eval_run_id: int,
    run_dir: Path,
    served_model_name: str,
    task_name: str,
    benchmark: str,
    harness_image: str,
    samples: list[SampleRecord],
    subsets: list[SubsetSummary],
    force_recheck: bool = False,
) -> None:
    """Fills in every sample's `benchmark_details["rule_results"]` in
    place, reusing the on-disk artifact when it already covers every
    sample passed in. A finished run's `reviews/` files never change,
    so there is no real staleness question once the artifact's own
    version and benchmark match -- only coverage.

    Callers gate this on `registry.facts_for(benchmark).
    supports_rule_recheck`; this function does no benchmark
    dispatch of its own beyond what it hands the container.
    """
    artifact_path = _artifact_path(run_dir, served_model_name, task_name)
    expected_keys = _expected_keys(samples, subsets)
    if not expected_keys:
        logger.warning(
            "run %d: no sample resolved to a known reviews file; skipping recheck",
            eval_run_id,
        )
        return

    body = None if force_recheck else _reusable_body(artifact_path, benchmark, expected_keys)
    if body is None:
        body = _run_container(
            eval_run_id=eval_run_id,
            run_dir=run_dir,
            served_model_name=served_model_name,
            task_name=task_name,
            benchmark=benchmark,
            harness_image=harness_image,
            artifact_path=artifact_path,
        )
    if body is None:
        return  # already logged; every rule_results stays whatever it was

    for sample in samples:
        file = _file_for_subset(subsets, sample.subset)
        rules = body.get((file, sample.index)) if file is not None else None
        if rules is not None:
            sample.benchmark_details["rule_results"] = rules


def _artifact_path(run_dir: Path, served_model_name: str, task_name: str) -> Path:
    """Kept alongside the diagnostics file itself, not under a
    separate cache root -- Decision 2's note (S-D2-adjacent) is that
    everything about a run's diagnostics lives inside its own run
    folder, so a future S3 sync is a plain directory copy.
    """
    return run_dir / "diagnostics" / served_model_name / f"{task_name}.rule_results.jsonl"


def _file_for_subset(subsets: list[SubsetSummary], subset_name: str) -> str | None:
    for subset in subsets:
        if subset.name == subset_name:
            return subset.file
    return None


def _expected_keys(
    samples: list[SampleRecord], subsets: list[SubsetSummary]
) -> set[tuple[str, int]]:
    """(reviews file, index) for every sample -- what a reusable
    artifact has to cover. Keyed on the file, not the subset name
    alone: IFEval/IFBench only ever have one subset today, but
    `index` restarts at 0 in every subset file for a benchmark that
    has more than one (MMLU-Pro), and this is the same discipline
    `evalscope_reviews.py` uses for exactly that reason.
    """
    keys: set[tuple[str, int]] = set()
    for sample in samples:
        file = _file_for_subset(subsets, sample.subset)
        if file is not None:
            keys.add((file, sample.index))
    return keys


def _reusable_body(
    artifact_path: Path, benchmark: str, expected_keys: set[tuple[str, int]]
) -> dict[tuple[str, int], list[dict[str, Any]]] | None:
    parsed = _read_artifact(artifact_path)
    if parsed is None:
        return None
    header, body = parsed
    if header.get("recheck_version") != _RECHECK_VERSION or header.get("benchmark") != benchmark:
        return None
    if not expected_keys.issubset(body.keys()):
        return None
    return body


def _read_artifact(
    artifact_path: Path,
) -> tuple[dict[str, Any], dict[tuple[str, int], list[dict[str, Any]]]] | None:
    """`None` for a missing or unparseable artifact -- treated the
    same as "nothing usable yet", matching `store.load`'s own
    discipline for the diagnostics file itself.
    """
    if not artifact_path.exists():
        return None
    try:
        lines = [line for line in artifact_path.read_text().split("\n") if line.strip()]
        header = json.loads(lines[0])
        body = {
            (record["file"], record["index"]): record["rules"]
            for record in (json.loads(line) for line in lines[1:])
        }
        return header, body
    except (json.JSONDecodeError, IndexError, KeyError) as exc:
        logger.warning("recheck artifact at %s is not usable (%s); will re-run", artifact_path, exc)
        return None


def _run_container(
    *,
    eval_run_id: int,
    run_dir: Path,
    served_model_name: str,
    task_name: str,
    benchmark: str,
    harness_image: str,
    artifact_path: Path,
) -> dict[tuple[str, int], list[dict[str, Any]]] | None:
    reviews_dir = run_dir / "reviews" / served_model_name
    # Glob, never construct the filename -- MMLU-Pro's real subset
    # files include a space ("mmlu_pro_computer science.jsonl"), the
    # same trap evalscope_reviews.py's own subset discovery avoids.
    # MMLU-Pro never reaches this function (registry.py leaves its
    # supports_rule_recheck False), but the discipline costs nothing
    # to keep either way.
    reviews_paths = sorted(reviews_dir.glob(f"{task_name}_*.jsonl"))
    if not reviews_paths:
        logger.warning(
            "run %d: no reviews files for %s/%s under %s; skipping recheck",
            eval_run_id,
            served_model_name,
            task_name,
            run_dir,
        )
        return None

    container_work_dir = harness_runner.CONTAINER_WORK_DIR
    container_reviews_files = [
        f"{container_work_dir}/{path.relative_to(run_dir)}" for path in reviews_paths
    ]
    container_output_file = f"{container_work_dir}/{artifact_path.relative_to(run_dir)}"

    # Left on disk after the run, deliberately -- same reasoning as
    # harness_task_config.json at the run root (runner.py's own
    # docstring): when a recheck fails, the first useful question is
    # always "what did we actually ask the container to do".
    request_path = artifact_path.parent / f"{task_name}.recheck_request.json"
    request_path.parent.mkdir(parents=True, exist_ok=True)
    request_path.write_text(
        json.dumps(
            {
                "recheck_version": _RECHECK_VERSION,
                "benchmark": benchmark,
                "random_seed": _RANDOM_SEED,
                "reviews_files": container_reviews_files,
                "output_file": container_output_file,
            },
            indent=2,
        )
    )
    container_request_file = f"{container_work_dir}/{request_path.relative_to(run_dir)}"

    settings = get_settings()
    argv = [
        "docker",
        "run",
        "--rm",
        # The pass is CPU-only against corpora already baked into the
        # image (verified: both IFEval's and IFBench's checker modules
        # import and run cleanly with no network at all) -- no name
        # either, unlike runner.py's harness containers, since nothing
        # here ever needs to `docker kill` this one.
        "--network",
        "none",
        "--entrypoint",
        "python",
        "-v",
        f"{harness_runner.host_run_directory(eval_run_id)}:{container_work_dir}",
        "-v",
        f"{settings.harness_scripts_host_path.rstrip('/')}:/opt/recheck:ro",
        harness_image,
        "/opt/recheck/recheck_instructions.py",
        container_request_file,
    ]
    logger.debug("recheck invocation for run %d: %s", eval_run_id, argv)

    try:
        result = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=_RECHECK_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        logger.exception("run %d: recheck container failed to start or run", eval_run_id)
        return None

    if result.returncode != 0:
        logger.warning(
            "run %d: recheck container exited %d: %s",
            eval_run_id,
            result.returncode,
            result.stderr[-2000:],
        )
        return None

    parsed = _read_artifact(artifact_path)
    if parsed is None:
        logger.warning(
            "run %d: recheck container exited 0 but wrote no usable artifact at %s",
            eval_run_id,
            artifact_path,
        )
        return None
    return parsed[1]
