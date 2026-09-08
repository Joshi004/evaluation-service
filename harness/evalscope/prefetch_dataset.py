"""Prefetches opencompass/ifeval at build time, through the exact code
path a real evaluation run uses to load it -- not a hand-rolled
ModelScope download call.

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
dataset_dir or dataset_hub either, so get_benchmark("ifeval", ...)
resolves to the exact same cache path here and at eval time --
confirmed by reading evalscope/api/dataset/loader.py and
evalscope/config.py at the pinned commit, not assumed.

This is the one build step decision D2 flagged as genuinely uncertain
in advance (docs/IMPLEMENTATION_PHASES.md Phase 4, item 1). It is no
longer a guess -- the loading path above was read directly from the
pinned commit's source, not inferred from documentation -- but it also
hasn't yet been exercised end to end against a real, from-scratch
network build in this environment. Confirm `docker compose build
harness` completes, then confirm a container run from the built image
with `--network none` can still load this dataset before trusting the
image for a real run.
"""

from evalscope.api.registry import get_benchmark
from evalscope.config import TaskConfig

task_config = TaskConfig(datasets=["ifeval"])
benchmark = get_benchmark("ifeval", task_config)
benchmark.load_dataset()
