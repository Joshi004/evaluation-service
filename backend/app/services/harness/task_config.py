"""Builds the EvalScope task config from a resolved `standard` row, a
resolved `sampling_profile` row, a `checkpoint` row, and a live
`endpoint` row.

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

from app.models import Checkpoint, Endpoint, SamplingProfile, Standard


def build_task_config(
    standard: Standard,
    sampling_profile: SamplingProfile,
    checkpoint: Checkpoint,
    endpoint: Endpoint,
    container_work_dir: str,
) -> dict[str, Any]:
    """Every field a real `TaskConfig`/`GenerateConfig` accepts, passed
    explicitly -- even where it currently matches EvalScope's own
    registered default. That's deliberate: it's what makes the standard
    and sampling-profile hashes a verification tool rather than a
    label. If a future EvalScope upgrade silently changes one of its own
    defaults, our number doesn't move with it, because nothing here was
    ever implicit.

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

    Every field in `Standard.as_hashable_dict()` and
    `SamplingProfile.as_hashable_dict()` is accounted for below, either
    by where it lands in the returned dict or by why it deliberately
    doesn't -- a silently-dropped field is exactly how the
    `enable_thinking` bug shipped (see the `extra_body` comment below).

    From the standard:
    - `benchmark`, `framework`: not sent -- they identify the standard to
      a human (frontend, docs), not to EvalScope.
    - `framework_image`: not sent by this function -- `runner.py` picks
      the harness image from `settings.harness_image`, not per standard.
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
    - `think_handling`: not sent -- resolved at compatibility-check time
      against the serving profile's `reasoning_parser`
      (services/compatibility/rules.py), not something EvalScope reads.
    - `sampling_overrides`: not sent directly -- it was already merged
      into `sampling_profile` before this function was called (S-D4), so
      every value it mandates already appears below under the sampling
      profile's own fields.
    - `subsets`: `dataset_args.<task>.subset_list`, via `_dataset_args` --
      Phase 4, replacing what used to be a hardcoded `["default"]`.
    - `eval_batch_size`: `eval_batch_size`, replacing a hardcoded `32`.
      Not part of `Standard.as_hashable_dict()` (S-D7) -- it changes how
      fast the benchmark runs, never what it measures.
    - `request_timeout_seconds`: `generation_config.timeout`, under
      EvalScope's own field name -- replacing a hardcoded `1800`. Also
      not hashed, for the same S-D7 reason as `eval_batch_size`.

    From the sampling profile:
    - `temperature`, `top_p`, `top_k`, `presence_penalty`,
      `repetition_penalty`, `max_tokens`: `generation_config`.
    - `min_p`: not sent -- decision D4, see the comment inline at
      `generation_config`.
    - `enable_thinking`:
      `generation_config.extra_body.chat_template_kwargs.enable_thinking`.
    - `seed`: `seed`, replacing what used to be a hardcoded `42`.
    """
    return {
        "model": checkpoint.name,
        "api_url": endpoint.url,
        "api_key": "EMPTY",
        "eval_type": "openai_api",  # HTTP only -- never loads the model itself
        "datasets": [standard.task_name],
        "dataset_args": {standard.task_name: _dataset_args(standard)},
        "generation_config": {
            "temperature": sampling_profile.temperature,
            "top_p": sampling_profile.top_p,
            "top_k": sampling_profile.top_k,
            "presence_penalty": sampling_profile.presence_penalty,
            "repetition_penalty": sampling_profile.repetition_penalty,
            "max_tokens": sampling_profile.max_tokens,
            # min_p deliberately NOT passed -- decision D4. A sampling
            # profile may record a non-zero min_p (nothing rejects that
            # at load time), but EvalScope's openai_api path drops it
            # silently, so passing it here would claim a control that
            # doesn't exist. The human-visible warning lives on the
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
            # sampling profile can be in flight against the same server at
            # once. Passed explicitly in both directions, per this
            # function's own rule -- Qwen3's own default is
            # enable_thinking=True, and leaving this out for a sampling
            # profile with enable_thinking=False silently ran that run in
            # thinking mode anyway (confirmed against a real run: 100% of
            # predictions carried a <think> block under a stored
            # enable_thinking: false sampling profile).
            "extra_body": {
                "chat_template_kwargs": {"enable_thinking": sampling_profile.enable_thinking}
            },
            "timeout": standard.request_timeout_seconds,
        },
        "repeats": standard.repeats,
        "seed": sampling_profile.seed,
        "limit": standard.sample_limit,
        "eval_batch_size": standard.eval_batch_size,
        "work_dir": container_work_dir,
        "no_timestamp": True,
        # One bad sample shouldn't cost the whole run; truncation_rate
        # and eval_run.error are what stop that costing something
        # anyway, invisibly (Trap T2). Never flip this to False "to be
        # safe" -- that loses a whole run to one bad sample instead.
        "ignore_errors": True,
    }


def _dataset_args(standard: Standard) -> dict[str, Any]:
    """The `dataset_args.<task_name>` block EvalScope's benchmark
    registration reads -- which samples run and how they're framed, as
    opposed to `generation_config`'s job of saying how the model answers.

    `eval_split` is EvalScope's own field name (`BenchmarkMeta.eval_split`),
    not `split` -- `BenchmarkMeta._update` (evalscope's registry) sets an
    attribute only when `hasattr` already agrees, and silently drops
    anything else, so the wrong name here would look like it worked while
    actually falling through to EvalScope's own registered default.
    Omitted entirely when `standard.split` is null, same as
    `dataset_revision`'s null: "we don't have one," not "send an empty
    one."
    """
    args: dict[str, Any] = {
        "dataset_id": standard.dataset_name,
        "subset_list": standard.subsets,
        "few_shot_num": standard.few_shot,
        "prompt_template": standard.prompt_template,
        "metric_list": _metric_names(standard.metrics),
    }
    if standard.split is not None:
        args["eval_split"] = standard.split
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
