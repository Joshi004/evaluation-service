"""Request/response shapes for /api/v1/runs and /api/v1/run-groups.

See docs/IMPLEMENTATION_PHASES.md Phase 5 for submit/cancel, Phase 6 for
the preview, detail, and log-streaming additions, and
docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3 for the standard/sampling
split below.
"""

from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.compatibility import CompatibilityFinding
from app.schemas.diagnostics import RunPerformanceSummary
from app.schemas.serving_profiles import ServingProfileSummary
from app.schemas.standards import SamplingFieldWarning


class RunListItem(BaseModel):
    """One eval_run row, plus the names a human needs to read it without
    a second round trip -- checkpoint_name, standard_label (falling back
    to standard_hash when the standard is an unlabelled override),
    benchmark, and run_group_name. Joined in server-side, the same
    reasoning as EndpointListItem's checkpoint_name/gpus
    (app/schemas/endpoints.py).
    """

    id: int
    run_group_id: int
    run_group_name: str
    checkpoint_id: int
    checkpoint_name: str
    standard_id: int
    standard_label: str | None
    standard_hash: str
    benchmark: str
    endpoint_id: int | None
    status: str
    truncation_rate: float | None
    error: str | None
    submitted_by: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class StandardOverrides(BaseModel):
    """A user override of a base standard's protocol fields -- the
    whole mechanism from docs/IMPLEMENTATION_PHASES.md Section 0.6,
    narrowed in Phase 3 to the fields that stayed on `standard` once
    sampling moved out. Every field here mirrors the protocol subset of
    `Standard.as_hashable_dict()` and is optional: only fields the
    caller actually set are merged into the base standard's config, via
    `model_dump(exclude_unset=True)`. Pydantic's `exclude_unset` tells
    "the caller wrote `null`" apart from "the caller didn't mention this
    field at all" -- which matters here, since `dataset_revision`,
    `split` and `sample_limit` are legitimately nullable overrides.

    Deliberately has no `sampling_overrides` field of its own: that key
    names what the *benchmark* mandates, not what a submit's caller
    wants -- a caller reaching for different sampling uses
    `SamplingOverrides` or `sampling_profile_id` instead.

    `extra="forbid"` turns a typo'd or unknown field into a 422 at the
    API boundary, instead of a bare `TypeError` deep inside
    `insert_standard()`'s `Standard(**config)` (a 500).
    """

    model_config = ConfigDict(extra="forbid")

    benchmark: str | None = None
    framework: str | None = None
    framework_image: str | None = None
    task_name: str | None = None
    dataset_name: str | None = None
    dataset_revision: str | None = None
    split: str | None = None
    few_shot: int | None = None
    prompt_template: str | None = None
    extraction: dict[str, Any] | None = None
    metrics: list[dict[str, Any]] | None = None
    repeats: int | None = None
    sample_limit: int | None = None
    think_handling: str | None = None


class SamplingOverrides(BaseModel):
    """A user override of a resolved sampling profile's fields -- the
    third and last layer of S-D4's merge, applied after the checkpoint's
    own default (or an explicitly picked `sampling_profile_id`) and the
    standard's `sampling_overrides`. Mirrors `StandardOverrides`'
    `exclude_unset` / `extra="forbid"` discipline exactly, over exactly
    `SamplingProfile.as_hashable_dict()`'s nine fields.
    """

    model_config = ConfigDict(extra="forbid")

    temperature: float | None = None
    top_p: float | None = None
    top_k: int | None = None
    min_p: float | None = None
    presence_penalty: float | None = None
    repetition_penalty: float | None = None
    max_tokens: int | None = None
    enable_thinking: bool | None = None
    seed: int | None = None


class ServingOverrides(BaseModel):
    """A user override of a resolved serving profile's fields -- the
    submit-time analogue of `SamplingOverrides`, over the subset of
    `ServingProfileConfig`'s eleven fields that actually change how the
    engine launches. Deliberately excludes `engine`, `engine_version`
    and `engine_options`: `app.services.cluster.serve_job` pins the vLLM
    binary itself, so overriding those would move this override's hash
    without moving what launch actually runs. Mirrors `SamplingOverrides`'
    `exclude_unset` / `extra="forbid"` discipline exactly.
    """

    model_config = ConfigDict(extra="forbid")

    gpus: int | None = None
    tensor_parallel_size: int | None = None
    pipeline_parallel_size: int | None = None
    max_model_len: int | None = None
    reasoning_parser: str | None = None
    dtype: str | None = None
    quantization: str | None = None
    gpu_memory_utilization: float | None = None


def _require_keys_subset(
    keys_by_id: dict[int, Any], allowed_ids: list[int], dict_name: str, id_set_name: str
) -> None:
    """One override, profile-id, or label map's keys must all be ids
    this request actually selected -- shared by every `*_by_standard_id`
    and `*_by_checkpoint_id` map below, so a typo'd or stale key 422s
    with the same message shape regardless of which map it's in.
    """
    unknown_ids = set(keys_by_id) - set(allowed_ids)
    if unknown_ids:
        raise ValueError(f"{dict_name} has id(s) not in {id_set_name}: {sorted(unknown_ids)}")


def _require_override_keys_are_selected(
    *,
    standard_ids: list[int],
    checkpoint_ids: list[int],
    standard_overrides_by_standard_id: dict[int, StandardOverrides],
    sampling_overrides_by_checkpoint_id: dict[int, SamplingOverrides],
    sampling_profile_id_by_checkpoint_id: dict[int, int],
    serving_overrides_by_checkpoint_id: dict[int, ServingOverrides],
    serving_profile_id_by_checkpoint_id: dict[int, int],
    standard_label_by_standard_id: dict[int, str],
    sampling_label_by_checkpoint_id: dict[int, str],
    serving_label_by_checkpoint_id: dict[int, str],
) -> None:
    """An override, profile-id, or label keyed by an id outside this
    request's own `standard_ids`/`checkpoint_ids` must 422, not be
    silently dropped -- dropping it would leave the caller believing an
    override applied (e.g. to a checkpoint just unchecked in the UI)
    when it didn't. Shared by `CreateRunsRequest` and
    `RunPreviewRequest`; the latter has no label maps of its own (a
    preview never inserts, so a label has nothing to attach to), and
    passes `{}` for each.
    """
    _require_keys_subset(
        standard_overrides_by_standard_id,
        standard_ids,
        "standard_overrides_by_standard_id",
        "standard_ids",
    )
    _require_keys_subset(
        standard_label_by_standard_id, standard_ids, "standard_label_by_standard_id", "standard_ids"
    )
    _require_keys_subset(
        sampling_overrides_by_checkpoint_id,
        checkpoint_ids,
        "sampling_overrides_by_checkpoint_id",
        "checkpoint_ids",
    )
    _require_keys_subset(
        sampling_profile_id_by_checkpoint_id,
        checkpoint_ids,
        "sampling_profile_id_by_checkpoint_id",
        "checkpoint_ids",
    )
    _require_keys_subset(
        sampling_label_by_checkpoint_id,
        checkpoint_ids,
        "sampling_label_by_checkpoint_id",
        "checkpoint_ids",
    )
    _require_keys_subset(
        serving_overrides_by_checkpoint_id,
        checkpoint_ids,
        "serving_overrides_by_checkpoint_id",
        "checkpoint_ids",
    )
    _require_keys_subset(
        serving_profile_id_by_checkpoint_id,
        checkpoint_ids,
        "serving_profile_id_by_checkpoint_id",
        "checkpoint_ids",
    )
    _require_keys_subset(
        serving_label_by_checkpoint_id,
        checkpoint_ids,
        "serving_label_by_checkpoint_id",
        "checkpoint_ids",
    )


class CreateRunsRequest(BaseModel):
    """POST body for /api/v1/runs. Every (checkpoint, standard) pair in
    the cartesian product of checkpoint_ids x standard_ids becomes one
    queued eval_run row, all sharing one new run_group -- always one,
    even for a single run (docs/IMPLEMENTATION_PHASES.md Phase 5, item
    1).

    Overrides are keyed per-axis, not one grid-wide value each: a
    standard's shape (few_shot, repeats, ...) belongs to that standard
    alone, and a sampling override or an explicit profile choice belongs
    to that checkpoint alone (`merge_sampling_config`,
    app/services/runs/submit.py) -- a single grid-wide value would apply
    identically to every selected checkpoint or standard regardless of
    which one a caller meant to change. A checkpoint id absent from
    `sampling_profile_id_by_checkpoint_id` falls back to that
    checkpoint's own `default_sampling_profile_id` (S-D9's fallback,
    unchanged from before this per-axis split).

    `extra="forbid"` here too: a caller still sending the old grid-wide
    field names must 422, not have those overrides silently ignored.
    """

    model_config = ConfigDict(extra="forbid")

    name: str
    checkpoint_ids: list[int] = Field(min_length=1)
    standard_ids: list[int] = Field(min_length=1)
    standard_overrides_by_standard_id: dict[int, StandardOverrides] = {}
    sampling_overrides_by_checkpoint_id: dict[int, SamplingOverrides] = {}
    sampling_profile_id_by_checkpoint_id: dict[int, int] = {}
    serving_overrides_by_checkpoint_id: dict[int, ServingOverrides] = {}
    serving_profile_id_by_checkpoint_id: dict[int, int] = {}
    # Applied to whichever row this submit actually mints for that id --
    # a hash hit reuses an existing (already labelled or not) row
    # untouched, so a label here only ever attaches to a brand new row
    # (`resolve_standard`/`resolve_sampling_profile`/
    # `resolve_serving_profile`'s own `label` parameter). `min_length=1`
    # on the value: the frontend's "untouched, no label" state is the
    # key's *absence*, not an empty string, so an empty string here
    # would only ever be a bug -- catch it as a 422, not a UNIQUE
    # constraint two empty labels would eventually trip over.
    standard_label_by_standard_id: dict[int, Annotated[str, Field(min_length=1)]] = {}
    sampling_label_by_checkpoint_id: dict[int, Annotated[str, Field(min_length=1)]] = {}
    serving_label_by_checkpoint_id: dict[int, Annotated[str, Field(min_length=1)]] = {}
    submitted_by: str | None = None

    @model_validator(mode="after")
    def _override_keys_are_selected(self) -> "CreateRunsRequest":
        _require_override_keys_are_selected(
            standard_ids=self.standard_ids,
            checkpoint_ids=self.checkpoint_ids,
            standard_overrides_by_standard_id=self.standard_overrides_by_standard_id,
            sampling_overrides_by_checkpoint_id=self.sampling_overrides_by_checkpoint_id,
            sampling_profile_id_by_checkpoint_id=self.sampling_profile_id_by_checkpoint_id,
            serving_overrides_by_checkpoint_id=self.serving_overrides_by_checkpoint_id,
            serving_profile_id_by_checkpoint_id=self.serving_profile_id_by_checkpoint_id,
            standard_label_by_standard_id=self.standard_label_by_standard_id,
            sampling_label_by_checkpoint_id=self.sampling_label_by_checkpoint_id,
            serving_label_by_checkpoint_id=self.serving_label_by_checkpoint_id,
        )
        return self


class RunSubmission(BaseModel):
    """202 response body for POST /api/v1/runs -- exactly what was
    created, so a caller can immediately poll GET /runs?run_group_id=...
    """

    run_group_id: int
    run_ids: list[int]


class RunGroupCancellation(BaseModel):
    """Response body for POST /api/v1/run-groups/{id}/cancel."""

    run_group_id: int
    cancelled_run_ids: list[int]


class RunPreviewRequest(BaseModel):
    """Request body for POST /api/v1/runs/preview -- the same grid shape
    and the same per-axis override maps as CreateRunsRequest (see its
    docstring), minus `name` and `submitted_by`, neither of which
    affects what would be validated or resolved.
    """

    model_config = ConfigDict(extra="forbid")

    checkpoint_ids: list[int] = Field(min_length=1)
    standard_ids: list[int] = Field(min_length=1)
    standard_overrides_by_standard_id: dict[int, StandardOverrides] = {}
    sampling_overrides_by_checkpoint_id: dict[int, SamplingOverrides] = {}
    sampling_profile_id_by_checkpoint_id: dict[int, int] = {}
    serving_overrides_by_checkpoint_id: dict[int, ServingOverrides] = {}
    serving_profile_id_by_checkpoint_id: dict[int, int] = {}

    @model_validator(mode="after")
    def _override_keys_are_selected(self) -> "RunPreviewRequest":
        _require_override_keys_are_selected(
            standard_ids=self.standard_ids,
            checkpoint_ids=self.checkpoint_ids,
            standard_overrides_by_standard_id=self.standard_overrides_by_standard_id,
            sampling_overrides_by_checkpoint_id=self.sampling_overrides_by_checkpoint_id,
            sampling_profile_id_by_checkpoint_id=self.sampling_profile_id_by_checkpoint_id,
            serving_overrides_by_checkpoint_id=self.serving_overrides_by_checkpoint_id,
            serving_profile_id_by_checkpoint_id=self.serving_profile_id_by_checkpoint_id,
            # No label maps of its own -- see
            # _require_override_keys_are_selected's docstring.
            standard_label_by_standard_id={},
            sampling_label_by_checkpoint_id={},
            serving_label_by_checkpoint_id={},
        )
        return self


class RunPreviewPair(BaseModel):
    """One (checkpoint, standard) cell of the grid a submit would
    create. `errors` and `warnings` are exactly what
    `app.services.compatibility.validator.validate_compatibility` found
    for this pair's (checkpoint, serving profile, standard, sampling
    profile) tuple.

    `blocking_error` stays alongside them, joined from `errors` the same
    way `submit.py` itself joins them before raising -- so the preview
    and a real submit can never disagree about what a value does, and
    the existing Submit page keeps working unchanged until Phase 8
    renders the structured lists instead.

    `comparison_hash` is what this pair's run would actually be grouped
    under on the leaderboard (S-D5) -- computed from this same standard
    and resolved-sampling hash pair, via the one `comparison_hash()`
    definition in `app.services.runs.comparison` (S-D23). Phase 8 shows
    it before the run, not only after, on the leaderboard.
    """

    checkpoint_id: int
    checkpoint_name: str
    standard_id: int
    standard_label: str | None
    benchmark: str
    errors: list[CompatibilityFinding]
    warnings: list[CompatibilityFinding]
    blocking_error: str | None
    comparison_hash: str


class FieldChange(BaseModel):
    """One field an override would change from its base value --
    equally usable for a standard's protocol fields and a sampling
    profile's fields, since both are just "a base config, merged with
    overrides". `base_value`/`override_value` are typed `Any` because a
    field's value is genuinely dynamic across fields (a float for
    `temperature`, a dict for `extraction`).
    """

    field: str
    base_value: Any
    override_value: Any


class ResolvedStandardPreview(BaseModel):
    """What `resolve_standard` would do for one base standard plus the
    submit's protocol overrides, without actually doing it:
    `is_new_standard` is computed with `standard_hash` +
    `get_standard_by_hash` rather than by calling `resolve_standard`,
    which inserts (see app.services.runs.preview) -- a preview must
    never mint a standard row for a submit that may never happen.
    """

    base_standard_id: int
    hash: str
    is_new_standard: bool
    changed_fields: list[FieldChange]


class ResolvedSamplingPreview(BaseModel):
    """What `resolve_sampling_profile` would do for one (checkpoint,
    standard) pair, without actually doing it -- mirrors
    `ResolvedStandardPreview` exactly, but keyed by a pair rather than a
    base standard alone, because the merge's first layer
    (`base_sampling_profile_id`) is the checkpoint's own default (or an
    explicitly picked profile) and its second layer
    (`standard.sampling_overrides`) varies per standard, so the same
    override can resolve to a different profile for every cell of the
    grid.
    """

    checkpoint_id: int
    standard_id: int
    base_sampling_profile_id: int
    hash: str
    is_new_sampling_profile: bool
    changed_fields: list[FieldChange]
    warnings: list[SamplingFieldWarning]


class ResolvedServingPreview(BaseModel):
    """What `resolve_serving_profile` would do for one checkpoint's
    serving override, without actually doing it -- mirrors
    `ResolvedStandardPreview` exactly, but keyed by `checkpoint_id` alone
    rather than a pair: unlike sampling, nothing about a standard feeds
    into serving, so one checkpoint resolves to exactly one serving
    profile regardless of which (or how many) standards are selected
    alongside it.

    `gpus` is carried here, not just inside `changed_fields`, because
    `RunPreview.gpu_count` is summed over exactly these resolved
    profiles (Trap T1) -- a `gpus` override must move the GPU count a
    user reads before submitting, not only after.
    """

    checkpoint_id: int
    base_serving_profile_id: int
    hash: str
    is_new_serving_profile: bool
    changed_fields: list[FieldChange]
    gpus: int


class RunPreview(BaseModel):
    """Response for POST /api/v1/runs/preview -- everything the Submit
    page needs to render before anything POSTs: how many runs, how many
    GPUs (Trap T1: distinct checkpoints, not distinct runs -- a submit of
    one checkpoint against six benchmarks costs one GPU, not six), which
    pairs are blocked and why, and what each override would actually
    resolve to on both sides of the standard/sampling split.
    """

    run_count: int
    gpu_count: int
    pairs: list[RunPreviewPair]
    resolved_standards: list[ResolvedStandardPreview]
    resolved_sampling: list[ResolvedSamplingPreview]
    resolved_serving: list[ResolvedServingPreview]


class RunMetric(BaseModel):
    """One `metric` row a finished run produced."""

    name: str
    value: float
    n_samples: int | None
    is_primary: bool


class RunEndpointSummary(BaseModel):
    """The vLLM server a run ran against -- just enough for a human
    reading the run detail page to see whether it's still live, not the
    full EndpointListItem shape (which also carries checkpoint_name and
    gpus, already known from the run itself).
    """

    id: int
    url: str | None
    slurm_job_id: int | None
    expires_at: datetime


class RunStandardDetail(BaseModel):
    """The fully resolved standard a run actually used -- every
    protocol field that can affect its score. The same shape as
    `StandardSummary` (app/schemas/standards.py) minus `source_yaml`
    (which only exists for a reviewed standard, not an ad-hoc override)
    and `warnings` (moved to `RunSamplingDetail` -- a D4 warning is
    about a sampling field, and this run's resolved sampling profile,
    not this standard's bare `sampling_overrides`, is the complete
    picture of what the run actually asked the model to do).
    """

    id: int
    hash: str
    label: str | None
    benchmark: str
    framework: str
    framework_image: str
    task_name: str
    dataset_name: str
    dataset_revision: str | None
    split: str | None
    train_split: str | None
    few_shot: int
    prompt_template: str
    few_shot_prompt_template: str | None
    extraction: dict[str, Any]
    metrics: list[dict[str, Any]]
    repeats: int
    sample_limit: int | None
    think_handling: str
    sampling_overrides: dict[str, Any]
    subsets: list[str]
    eval_batch_size: int
    request_timeout_seconds: int
    created_at: datetime


class RunSamplingDetail(BaseModel):
    """The fully resolved sampling profile a run actually used -- every
    field that can change how the model was asked to speak, plus
    decision D4's per-field warnings computed against this standard's
    `framework` (the same `sampling_field_warnings` the Standards page
    and the Submit preview also use, so a run's own page never disagrees
    with either).
    """

    id: int
    hash: str
    label: str | None
    temperature: float
    top_p: float
    top_k: int
    min_p: float
    presence_penalty: float
    repetition_penalty: float
    max_tokens: int
    enable_thinking: bool
    seed: int
    warnings: list[SamplingFieldWarning]


class RunDetail(RunListItem):
    """GET /api/v1/runs/{id} -- the full row (RunListItem), plus what a
    human reads to actually understand what happened: the resolved
    standard, sampling profile and serving profile, the
    `comparison_hash` they produced, the endpoint it ran against (or
    None if it never got one -- Phase 5's known cancel-before-endpoint
    gap), its output directory, and its metric rows.

    `serving` is the run's own `eval_run.serving_profile_id`, not the
    checkpoint's current default (S-T12) -- the two can differ the
    moment a submit ever picks a profile explicitly, and this run's page
    must show what it actually ran against. Reuses `ServingProfileSummary`
    rather than a fourth resolved-detail schema: nothing about a serving
    profile's shape needs to change for the run context, unlike the
    standard/sampling split.
    """

    output_dir: str | None
    comparison_hash: str
    standard: RunStandardDetail
    sampling: RunSamplingDetail
    serving: ServingProfileSummary
    endpoint: RunEndpointSummary | None
    metrics: list[RunMetric]
    # Phase 1 of docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md: derived from
    # results_json plus the metrics above, not stored anywhere of its
    # own. Defaulted to None so get_run_detail's existing RunDetail(...)
    # construction below doesn't need to change -- controllers/runs.py's
    # get_run fills it in afterward. Stays None for a run with no
    # results_json yet (queued, running, failed, cancelled).
    performance: RunPerformanceSummary | None = None
