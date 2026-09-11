"""Prefetches every dataset a shipped standard needs at build time,
through the exact code path a real evaluation run uses to load it --
not a hand-rolled ModelScope download call.

`evalscope.api.registry.get_benchmark()` is what evalscope/run.py itself
calls to turn a dataset name into a live adapter (confirmed by reading
evalscope/run.py's evaluate_model() at the pinned commit). Calling
`.load_dataset()` on that adapter runs the identical
DefaultDataAdapter.load() -> load_from_remote() -> RemoteDataLoader.load()
chain a real run takes, which does two things worth prefetching here:

  1. Downloads the raw dataset through ModelScope (MsDataset.load),
     landing under MODELSCOPE_CACHE.
  2. Saves the loaded-and-processed dataset to evalscope's OWN on-disk
     cache (dataset.save_to_disk(...), under a path derived from
     TaskConfig.dataset_dir -- which defaults to a MODELSCOPE_CACHE
     subdirectory, not a fixed constant this script could safely
     replicate by hand without risking drift from evalscope's own path
     construction).

RemoteDataLoader.load() checks that second cache directory FIRST and,
if present, never calls ModelScope at all -- so replicating it here
(rather than only priming the raw ModelScope cache) is what actually
makes a real run's dataset load touch zero network. A real run's
TaskConfig (app/services/harness/task_config.py) never sets
dataset_dir or dataset_hub either, so get_benchmark(name, ...) resolves
to the exact same cache path here and at eval time -- confirmed by
reading evalscope/api/dataset/loader.py and evalscope/config.py at the
pinned commit, not assumed.

Each `TaskConfig(datasets=[name])` below takes every other field --
`few_shot_num`, `train_split`, `subset_list` -- from that benchmark's
own `BenchmarkMeta` registration, exactly like a real run's `TaskConfig`
does for any field a standard's YAML doesn't override. `load_dataset()`
loads the few-shot *source* split too, not only the eval split, when
`few_shot_num > 0 and train_split is not None`
(`DefaultDataAdapter._should_load_fewshot`, confirmed at the pinned
commit) -- so this loop also prefetches GSM8K's `train` and MMLU-Pro's
`validation` split. That coverage holds only because every standard in
`catalog/standards/` uses each benchmark's registered `few_shot_num`
unchanged (GSM8K's `4`, MMLU-Pro's `5`); a standard that later
overrides `few_shot` to a different value would need its source split
prefetched separately.

Decision D3 calls this prefetched snapshot "the image tag is the
dataset pin" -- Phase 5 (docs/STANDARDS_AND_PROFILES_PHASES.md, S-D31)
is why the image tag itself gained a `-tier1` suffix alongside the four
names this loop added: rebuilding a different dataset set under the
unchanged `2ce95c3` tag would break that pin silently.

This was the one build step decision D2 flagged as genuinely uncertain
in advance (docs/IMPLEMENTATION_PHASES.md Phase 4, item 1) for IFEval
alone. It is no longer a guess for any of the five -- the loading path
above was read directly from the pinned commit's source, not inferred
from documentation -- but it also hasn't yet been exercised end to end
against a real, from-scratch network build in this environment. Confirm
`docker compose build harness` completes, then confirm a container run
from the built image with `--network none` can still load every
dataset below before trusting the image for a real run.
"""

from evalscope.api.registry import get_benchmark
from evalscope.config import TaskConfig

# One entry per shipped standard's `task_name` (Phase 5) -- not "every
# benchmark evalscope registers," which would prefetch datasets no
# standard uses and bake nothing this image is actually pinned against.
_BENCHMARK_NAMES = ("ifeval", "ifbench", "gsm8k", "gpqa_diamond", "mmlu_pro")

for name in _BENCHMARK_NAMES:
    task_config = TaskConfig(datasets=[name])
    benchmark = get_benchmark(name, task_config)
    benchmark.load_dataset()
