"""Builds the EvalScope task config from a resolved `recipe` row, a
`checkpoint` row, and a live `endpoint` row.

Returns a plain dict, not a real `TaskConfig` -- decision D2 keeps
EvalScope's dependency tree out of the API process, so
`from evalscope import TaskConfig` is not importable here. This dict is
written to `run_dir/harness_task_config.json` by `runner.py`; the one
place `TaskConfig(**config)` actually runs is
`harness/evalscope/run_eval.py`, baked into the harness image, on the
other side of the docker socket. Same fields, same explicitness -- the
object is just constructed in a different process.
"""

from typing import Any

from app.models import Checkpoint, Endpoint, Recipe


def build_task_config(
    recipe: Recipe, checkpoint: Checkpoint, endpoint: Endpoint, container_work_dir: str
) -> dict[str, Any]:
    """Every field a real `TaskConfig`/`GenerateConfig` accepts, passed
    explicitly -- even where it currently matches EvalScope's own
    registered default. That's deliberate: it's what makes the recipe
    hash a verification tool rather than a label. If a future EvalScope
    upgrade silently changes one of its own defaults, our number
    doesn't move with it, because nothing here was ever implicit.

    `model` is `checkpoint.name`, not `endpoint.model_tag` -- `Endpoint`
    has no such column. `serve_job.py` puts `checkpoint.name` in
    `SERVED_NAME`, so that's what vLLM answers to, and it's therefore
    also what EvalScope will use as the `<model_tag>` path segment under
    both `predictions/` and `reports/` (Trap T3) -- both must be
    reconstructed from this one value, never from the checkpoint path.

    `container_work_dir` is a path inside the *harness* container (e.g.
    `/work`), not inside this backend process -- the harness is started
    by the host Docker daemon via `runner.py`, and never sees this
    process's filesystem.

    Every field in `Recipe.as_hashable_dict()` is accounted for below,
    either by where it lands in the returned dict or by why it
    deliberately doesn't -- a silently-dropped field is exactly how the
    `enable_thinking` bug shipped (see the `extra_body` comment below).

    - `benchmark`, `framework`: not sent -- they identify the standard to
      a human (frontend, docs), not to EvalScope.
    - `framework_image`: not sent by this function -- `runner.py` picks
      the harness image from `settings.harness_image`, not per recipe.
    - `task_name`: the `datasets` entry and the `dataset_args` key.
    - `dataset_name`: `dataset_args.<task>.dataset_id`.
    - `dataset_revision`: not sent (decision D3 -- no EvalScope knob
      exists for a ModelScope-hosted set).
    - `split`: `dataset_args.<task>.eval_split`, via `_dataset_args`;
      omitted when null.
    - `few_shot`: `dataset_args.<task>.few_shot_num`.
    - `prompt_template`: `dataset_args.<task>.prompt_template`.
    - `extraction`: not sent -- EvalScope's equivalent is
      `dataset_args.<task>.filters`, but every shipped standard is
      `method: none`, so there is nothing yet to translate.
    - `metrics`: `dataset_args.<task>.metric_list`, via `_metric_names`.
    - `repeats`, `sample_limit`: `repeats`, `limit`.
    - `temperature`, `top_p`, `top_k`, `presence_penalty`,
      `repetition_penalty`, `max_tokens`: `generation_config`.
    - `min_p`: not sent -- decision D4, see the comment inline at
      `generation_config`.
    - `enable_thinking`:
      `generation_config.extra_body.chat_template_kwargs.enable_thinking`.
    - `think_handling`: not sent -- resolved at compatibility-check time
      against the serving profile's `reasoning_parser`
      (services/compatibility/rules.py), not something EvalScope reads.
    """
    return {
        "model": checkpoint.name,
        "api_url": endpoint.url,
        "api_key": "EMPTY",
        "eval_type": "openai_api",  # HTTP only -- never loads the model itself
        "datasets": [recipe.task_name],
        "dataset_args": {recipe.task_name: _dataset_args(recipe)},
        "generation_config": {
            "temperature": recipe.temperature,
            "top_p": recipe.top_p,
            "top_k": recipe.top_k,
            "presence_penalty": recipe.presence_penalty,
            "repetition_penalty": recipe.repetition_penalty,
            "max_tokens": recipe.max_tokens,
            # min_p deliberately NOT passed -- decision D4. A recipe may
            # record a non-zero min_p (nothing rejects that at load
            # time), but EvalScope's openai_api path drops it silently,
            # so passing it here would claim a control that doesn't
            # exist. The human-visible warning lives on the
            # Standards/Submit pages, driven by
            # FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS
            # (services/standards/capabilities.py) -- not in this builder.
            #
            # extra_body is EvalScope's escape hatch straight into the
            # OpenAI-compatible request body -- openai_completion_params
            # forwards it verbatim, and chat_template_kwargs.enable_thinking
            # is vLLM's own per-request switch for Qwen3-style thinking.
            # It has to be per-request, not a serve-time flag: one endpoint
            # is shared by every run against the same
            # (checkpoint, serving_profile), so a think and a no-think
            # recipe can be in flight against the same server at once.
            # Passed explicitly in both directions, per this function's own
            # rule -- Qwen3's own default is enable_thinking=True, and
            # leaving this out for a recipe with enable_thinking=False
            # silently ran that recipe in thinking mode anyway (confirmed
            # against a real run: 100% of predictions carried a <think>
            # block under a stored enable_thinking: false recipe).
            "extra_body": {"chat_template_kwargs": {"enable_thinking": recipe.enable_thinking}},
            "timeout": 1800,
        },
        "repeats": recipe.repeats,
        "seed": 42,  # hardcoded, and inert while v1 runs greedy (temperature 0)
        "limit": recipe.sample_limit,
        "eval_batch_size": 32,
        "work_dir": container_work_dir,
        "no_timestamp": True,
        # One bad sample shouldn't cost the whole run; truncation_rate
        # and eval_run.error are what stop that costing something
        # anyway, invisibly (Trap T2). Never flip this to False "to be
        # safe" -- that loses a whole run to one bad sample instead.
        "ignore_errors": True,
    }


def _dataset_args(recipe: Recipe) -> dict[str, Any]:
    """The `dataset_args.<task_name>` block EvalScope's benchmark
    registration reads -- which samples run and how they're framed, as
    opposed to `generation_config`'s job of saying how the model answers.

    `eval_split` is EvalScope's own field name (`BenchmarkMeta.eval_split`),
    not `split` -- `BenchmarkMeta._update` (evalscope's registry) sets an
    attribute only when `hasattr` already agrees, and silently drops
    anything else, so the wrong name here would look like it worked while
    actually falling through to EvalScope's own registered default.
    Omitted entirely when `recipe.split` is null, same as
    `dataset_revision`'s null: "we don't have one," not "send an empty
    one."
    """
    args: dict[str, Any] = {
        "dataset_id": recipe.dataset_name,
        "subset_list": ["default"],
        "few_shot_num": recipe.few_shot,
        "prompt_template": recipe.prompt_template,
        "metric_list": _metric_names(recipe.metrics),
    }
    if recipe.split is not None:
        args["eval_split"] = recipe.split
    return args


def _metric_names(metrics: list[dict[str, Any]]) -> list[str]:
    """The plain metric names EvalScope's own benchmark registration
    expects in `dataset_args.<task>.metric_list` -- the part before the
    `:` in each metric's `harness_key` (e.g. "prompt_level_strict" from
    "prompt_level_strict:mean"). A named helper rather than an inline
    comprehension, so the harness_key convention (name:aggregation) is
    documented once instead of repeated at every call site -- see
    parser.py, which splits the same string on the same character for
    the opposite reason (finding a metric in the report).
    """
    return [metric["harness_key"].split(":")[0] for metric in metrics]
