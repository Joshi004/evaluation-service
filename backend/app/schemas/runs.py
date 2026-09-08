"""Request/response shapes for /api/v1/runs and /api/v1/run-groups.

See docs/IMPLEMENTATION_PHASES.md Phase 5 for submit/cancel and Phase 6
for the preview, detail, and log-streaming additions.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.recipes import RecipeFieldWarning


class RunListItem(BaseModel):
    """One eval_run row, plus the names a human needs to read it without
    a second round trip -- checkpoint_name, recipe_label (falling back to
    recipe_hash when the recipe is an unlabelled override), benchmark,
    and run_group_name. Joined in server-side, the same reasoning as
    EndpointListItem's checkpoint_name/gpus (app/schemas/endpoints.py).
    """

    id: int
    run_group_id: int
    run_group_name: str
    checkpoint_id: int
    checkpoint_name: str
    recipe_id: int
    recipe_label: str | None
    recipe_hash: str
    benchmark: str
    endpoint_id: int | None
    status: str
    truncation_rate: float | None
    error: str | None
    submitted_by: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class RecipeOverrides(BaseModel):
    """A user override of a base recipe's fields -- the whole mechanism
    from docs/IMPLEMENTATION_PHASES.md Section 0.6. Every field here
    mirrors `Recipe.as_hashable_dict()` and is optional: only fields the
    caller actually set are merged into the base recipe's config, via
    `model_dump(exclude_unset=True)`. Pydantic's `exclude_unset` tells
    "the caller wrote `null`" apart from "the caller didn't mention this
    field at all" -- which matters here, since `dataset_revision`,
    `split` and `sample_limit` are legitimately nullable overrides.

    `extra="forbid"` turns a typo'd or unknown field into a 422 at the
    API boundary, instead of a bare `TypeError` deep inside
    `insert_recipe()`'s `Recipe(**config)` (a 500).
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
    temperature: float | None = None
    top_p: float | None = None
    top_k: int | None = None
    min_p: float | None = None
    presence_penalty: float | None = None
    repetition_penalty: float | None = None
    max_tokens: int | None = None
    enable_thinking: bool | None = None
    think_handling: str | None = None


class CreateRunsRequest(BaseModel):
    """POST body for /api/v1/runs. Every (checkpoint, recipe) pair in the
    cartesian product of checkpoint_ids x recipe_ids becomes one queued
    eval_run row, all sharing one new run_group -- always one, even for a
    single run (docs/IMPLEMENTATION_PHASES.md Phase 5, item 1).
    """

    name: str
    checkpoint_ids: list[int] = Field(min_length=1)
    recipe_ids: list[int] = Field(min_length=1)
    overrides: RecipeOverrides = RecipeOverrides()
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
    recipe_ids: list[int] = Field(min_length=1)
    overrides: RecipeOverrides = RecipeOverrides()


class RunPreviewPair(BaseModel):
    """One (checkpoint, recipe) cell of the grid a submit would create.
    `blocking_error` is the exact text POST /runs would 400 with for
    this pair -- computed by the same functions
    (app.services.runs.submit.context_window_conflict and
    think_handling_conflict) submit.py itself raises with, so the
    preview and the real submit can never disagree about what a value
    does.
    """

    checkpoint_id: int
    checkpoint_name: str
    recipe_id: int
    recipe_label: str | None
    benchmark: str
    blocking_error: str | None


class RecipeFieldChange(BaseModel):
    """One field an override would change from the base recipe's value.
    `base_value`/`override_value` are typed `Any` because a recipe
    field's value is genuinely dynamic across fields (a float for
    `temperature`, a dict for `extraction`) -- the same shape
    `RecipeOverrides` above already accepts.
    """

    field: str
    base_value: Any
    override_value: Any


class ResolvedRecipePreview(BaseModel):
    """What `resolve_recipe` would do for one base recipe plus the
    submit's overrides, without actually doing it: `is_new_recipe` is
    computed with `recipe_hash` + `get_recipe_by_hash` rather than by
    calling `resolve_recipe`, which inserts (see
    app.services.runs.preview) -- a preview must never mint a recipe row
    for a submit that may never happen.
    """

    base_recipe_id: int
    hash: str
    is_new_recipe: bool
    changed_fields: list[RecipeFieldChange]
    warnings: list[RecipeFieldWarning]


class RunPreview(BaseModel):
    """Response for POST /api/v1/runs/preview -- everything the Submit
    page needs to render before anything POSTs: how many runs, how many
    GPUs (Trap T1: distinct checkpoints, not distinct runs -- a submit of
    one checkpoint against six benchmarks costs one GPU, not six), which
    pairs are blocked and why, and what each override would actually
    resolve to.
    """

    run_count: int
    gpu_count: int
    pairs: list[RunPreviewPair]
    resolved_recipes: list[ResolvedRecipePreview]


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


class RunRecipeDetail(BaseModel):
    """The fully resolved recipe a run actually used -- every field that
    can affect its score, plus decision D4's per-field warnings. The
    same shape as StandardRecipe (app/schemas/standards.py) minus the
    source YAML, which only exists for a reviewed standard, not an
    ad-hoc override.
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
    temperature: float
    top_p: float
    top_k: int
    min_p: float
    presence_penalty: float
    repetition_penalty: float
    max_tokens: int
    enable_thinking: bool
    think_handling: str
    created_at: datetime
    warnings: list[RecipeFieldWarning]


class RunDetail(RunListItem):
    """GET /api/v1/runs/{id} -- the full row (RunListItem), plus what a
    human reads to actually understand what happened: the resolved
    recipe, the endpoint it ran against (or None if it never got one --
    Phase 5's known cancel-before-endpoint gap), its output directory,
    and its metric rows.
    """

    output_dir: str | None
    recipe: RunRecipeDetail
    endpoint: RunEndpointSummary | None
    metrics: list[RunMetric]
