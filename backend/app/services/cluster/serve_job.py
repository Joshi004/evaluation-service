"""The parameterised vLLM serve job and the parser for its log markers.

See docs/IMPLEMENTATION_PHASES.md Phase 3, Appendix A. Appendix A's
script is what was validated on the cluster (job 285727, READY after
350s) -- this parameterises it, it does not rewrite it. Only the fields
on `ServeJobSpec` (docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 1) vary
per call; the readiness poll, the liveness check, and the port formula
are unchanged. This module knows no ORM model -- the adapter builds a
spec from `Checkpoint` / `ServingProfile` rows before calling here.
"""

import re
from dataclasses import dataclass
from typing import Literal

from app.services.cluster.ports import ServeJobSpec

# Feeds SLURM's %x-%j.out/.err filenames -- one constant so the template
# and services/endpoints/lifecycle.py's log path can't drift apart.
JOB_NAME = "evalsvc-vllm"

# Hardcoded to match Appendix A: there is exactly one known vLLM install,
# and it isn't in the doc's list of what to parameterise (model path,
# served name, GPUs, --time, engine args).
_EVAL_HOME = "/home/shared/agentic_slm/qvac-research-tool-call/evaluation"
_VLLM_BIN = f"{_EVAL_HOME}/venv/vllm/bin/vllm"

_READINESS_LOOP = """
VLLM_PID=$!

# Poll /v1/models until the served name appears, 900s timeout -- but bail
# out early if the server process dies. Without the liveness check a
# server that crashes on startup holds its GPUs for the whole timeout.
READY=0
for i in $(seq 1 180); do
    if ! kill -0 "${VLLM_PID}" 2>/dev/null; then
        echo "SERVER_DIED after $((i * 5))s -- exiting instead of waiting out the timeout"
        wait "${VLLM_PID}"
        echo "server exit code: $?"
        exit 1
    fi
    if curl -sS -m 3 "http://localhost:${PORT}/v1/models" 2>/dev/null \
        | grep -q "${SERVED_NAME}"; then
        echo "READY after $((i * 5))s : $(date -u +%FT%TZ)"
        READY=1
        break
    fi
    sleep 5
done

if [[ "${READY}" -ne 1 ]]; then
    echo "READINESS_TIMEOUT"
    kill "${VLLM_PID}" 2>/dev/null
    exit 1
fi

echo "SERVE_UP - holding for external requests"
wait "${VLLM_PID}"
"""


def compute_port(slurm_job_id: int) -> int:
    """tool-call's scheme (0.7): derives the vLLM port from the job id
    so two jobs on one node cannot collide. The script computes this
    same formula independently in bash -- kept as one Python function so
    the adapter (which needs the port before the log has necessarily
    been read -- see ssh_slurm_runtime.open_serving_tunnel) and the
    template below can't drift apart, which is exactly the bug R-T1
    exists to prevent.
    """
    return 8000 + (slurm_job_id % 250) * 8


def log_path(cluster_log_root: str, slurm_job_id: int) -> str:
    """Where SLURM's --output=%x-%j.out lands, given --chdir=cluster_log_root
    (connector.submit bakes that --chdir in)."""
    return f"{cluster_log_root}/{JOB_NAME}-{slurm_job_id}.out"


def _format_walltime(seconds: int) -> str:
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def render_serve_script(spec: ServeJobSpec) -> str:
    """Renders a submittable sbatch script for this spec. Passed to
    connector.submit() over stdin -- nothing is staged on the cluster.
    """
    header = (
        "#!/bin/bash\n"
        f"#SBATCH --job-name={JOB_NAME}\n"
        "#SBATCH --partition=main\n"
        "#SBATCH --nodes=1\n"
        "#SBATCH --ntasks=1\n"
        "#SBATCH --cpus-per-task=8\n"
        "#SBATCH --mem=64G\n"
        f"#SBATCH --gres=gpu:{spec.gpus}\n"
        # Non-negotiable per 0.7: `main` has MaxTime=UNLIMITED and
        # DefaultTime=NONE, so an explicit --time is the only thing
        # standing between a forgotten server and idle H100s over a
        # weekend.
        f"#SBATCH --time={_format_walltime(spec.walltime_seconds)}\n"
        "#SBATCH --output=%x-%j.out\n"
        "#SBATCH --error=%x-%j.err\n"
        "\n"
        "set -u\n"
        "\n"
        f'VLLM="{_VLLM_BIN}"\n'
        f'MODEL_PATH="{spec.model_reference}"\n'
        f'SERVED_NAME="{spec.served_name}"\n'
        "\n"
        "# tool-call's trick: derive the port from the job id so two jobs on\n"
        "# one node cannot collide.\n"
        "PORT=$(( 8000 + (SLURM_JOB_ID % 250) * 8 ))\n"
        "\n"
        'echo "SERVE_NODE=$(hostname)"\n'
        'echo "SERVE_PORT=${PORT}"\n'
        'echo "SERVE_JOB=${SLURM_JOB_ID}"\n'
        'echo "SERVE_MODEL=${SERVED_NAME}"\n'
        'echo "started : $(date -u +%FT%TZ)"\n'
        "\n"
    )

    # Every vLLM flag -- generation-config, parallelism, dtype,
    # gpu-memory-utilization, max-model-len, reasoning-parser,
    # quantization, and any engine_options escape hatch -- comes from
    # spec.engine_args, rendered by
    # services/serving_profiles/render.render_engine_args (Phase 3 of
    # docs/CHECKPOINT_REGISTRATION_PHASES.md). This module renders none
    # of them itself.
    vllm_command_lines = [
        '"${VLLM}" serve "${MODEL_PATH}"',
        '--served-model-name "${SERVED_NAME}"',
        "--host 0.0.0.0",
        '--port "${PORT}"',
    ]
    if spec.engine_args:
        # engine_args is a flat list of individual argv tokens (one
        # flag, one value, each its own element), not flag/value pairs,
        # so these join onto one line rather than risk mis-pairing a
        # token list that might someday include a bare (valueless) flag.
        vllm_command_lines.append(" ".join(spec.engine_args))
    vllm_command = " \\\n    ".join(vllm_command_lines) + " &\n"

    return header + vllm_command + _READINESS_LOOP


@dataclass
class ServeJobEvent:
    """One point-in-time reading of the serve job's log, per Trap T5:
    read the markers, never infer readiness from job state -- RUNNING
    means SLURM started the script, which is about six minutes before
    vLLM actually answers.
    """

    status: Literal["pending", "ready", "server_died", "readiness_timeout"]
    node: str | None = None
    port: int | None = None
    elapsed_seconds: int | None = None
    exit_code: int | None = None


_SERVE_NODE_RE = re.compile(r"^SERVE_NODE=(\S+)", re.MULTILINE)
_SERVE_PORT_RE = re.compile(r"^SERVE_PORT=(\d+)", re.MULTILINE)
_READY_RE = re.compile(r"^READY after (\d+)s", re.MULTILINE)
_SERVER_DIED_RE = re.compile(r"^SERVER_DIED after (\d+)s", re.MULTILINE)
_EXIT_CODE_RE = re.compile(r"^server exit code: (-?\d+)", re.MULTILINE)
_READINESS_TIMEOUT_RE = re.compile(r"^READINESS_TIMEOUT", re.MULTILINE)


def parse_serve_log(text: str) -> ServeJobEvent:
    node_match = _SERVE_NODE_RE.search(text)
    port_match = _SERVE_PORT_RE.search(text)
    node = node_match.group(1) if node_match else None
    port = int(port_match.group(1)) if port_match else None

    if _READINESS_TIMEOUT_RE.search(text):
        return ServeJobEvent(status="readiness_timeout", node=node, port=port)

    died_match = _SERVER_DIED_RE.search(text)
    if died_match:
        exit_code_match = _EXIT_CODE_RE.search(text)
        return ServeJobEvent(
            status="server_died",
            node=node,
            port=port,
            elapsed_seconds=int(died_match.group(1)),
            exit_code=int(exit_code_match.group(1)) if exit_code_match else None,
        )

    ready_match = _READY_RE.search(text)
    if ready_match:
        return ServeJobEvent(
            status="ready", node=node, port=port, elapsed_seconds=int(ready_match.group(1))
        )

    return ServeJobEvent(status="pending", node=node, port=port)
