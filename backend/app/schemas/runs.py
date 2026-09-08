"""Request/response shapes for /api/v1/runs and /api/v1/run-groups.

See docs/IMPLEMENTATION_PHASES.md Phase 5.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RunListItem(BaseModel):
    id: int
    run_group_id: int
    checkpoint_id: int
    recipe_id: int
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
