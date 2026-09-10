"""Request/response shapes for /api/v1/runs and /api/v1/run-groups.

See docs/IMPLEMENTATION_PHASES.md Phase 5 for submit/cancel, Phase 6 for
the preview, detail, and log-streaming additions, and
docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3 for the standard/sampling
split below.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.compatibility import CompatibilityFinding
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


class CreateRunsRequest(BaseModel):
    """POST body for /api/v1/runs. Every (checkpoint, standard) pair in
    the cartesian product of checkpoint_ids x standard_ids becomes one
    queued eval_run row, all sharing one new run_group -- always one,
    even for a single run (docs/IMPLEMENTATION_PHASES.md Phase 5, item
    1). `sampling_profile_id` is optional (S-D9): omitted means each
    checkpoint's own `default_sampling_profile_id`; given, it overrides
    that default for every checkpoint in the grid uniformly.
    """

    name: str
    checkpoint_ids: list[int] = Field(min_length=1)
    standard_ids: list[int] = Field(min_length=1)
    standard_overrides: StandardOverrides = StandardOverrides()
    sampling_overrides: SamplingOverrides = SamplingOverrides()
    sampling_profile_id: int | None = None
    submitted_by: str | None = None


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
    as CreateRunsRequest minus `name` and `submitted_by`, neither of
    which affects what would be validated or resolved.
    """

    checkpoint_ids: list[int] = Field(min_length=1)
    standard_ids: list[int] = Field(min_length=1)
    standard_overrides: StandardOverrides = StandardOverrides()
    sampling_overrides: SamplingOverrides = SamplingOverrides()
    sampling_profile_id: int | None = None


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
    """

    checkpoint_id: int
    checkpoint_name: str
    standard_id: int
    standard_label: str | None
    benchmark: str
    errors: list[CompatibilityFinding]
    warnings: list[CompatibilityFinding]
    blocking_error: str | None


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
    few_shot: int
    prompt_template: str
    extraction: dict[str, Any]
    metrics: list[dict[str, Any]]
    repeats: int
    sample_limit: int | None
    think_handling: str
    sampling_overrides: dict[str, Any]
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
    standard and sampling profile, the `comparison_hash` they produced,
    the endpoint it ran against (or None if it never got one -- Phase
    5's known cancel-before-endpoint gap), its output directory, and its
    metric rows.
    """

    output_dir: str | None
    comparison_hash: str
    standard: RunStandardDetail
    sampling: RunSamplingDetail
    endpoint: RunEndpointSummary | None
    metrics: list[RunMetric]
