"""Harness entrypoint: turn our backend's JSON task config into a real
EvalScope TaskConfig and run it.

The backend (app/services/harness/task_config.py) cannot import
evalscope -- decision D2 keeps EvalScope's dependency tree out of the
API process -- so the config crosses that process boundary as plain
JSON on disk instead of a TaskConfig object. This script is the other
half of that boundary: the one place TaskConfig actually gets
constructed. Deliberately tiny: every real decision (which fields, what
values) already happened in task_config.py; this just replays them.
"""

import json
import sys
from pathlib import Path

from evalscope import TaskConfig, run_task

if len(sys.argv) != 2:
    raise SystemExit(f"usage: {sys.argv[0]} <task_config.json>")

config_path = Path(sys.argv[1])
config = json.loads(config_path.read_text())
run_task(task_cfg=TaskConfig(**config))
