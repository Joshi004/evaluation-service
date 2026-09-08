"""Pydantic models for Phase 2: validating a standards YAML file on load,
and shaping the GET /api/v1/standards response.

See docs/IMPLEMENTATION_PHASES.md Phase 2 ("What to build", item 2) and
Section 0.6 for the exact field set a recipe's identity depends on.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, model_validator


class RecipeExtraction(BaseModel):
    """The `extraction` column is "shapeless per benchmark" (DATA_MODEL_V1.md
    Section 3.3) -- only `method` is guaranteed across every benchmark, so
    `extra="allow"` lets a future benchmark's extraction carry whatever
    else it needs without a schema change here.
    """

    model_config = ConfigDict(extra="allow")

    method: str


class RecipeMetricDefinition(BaseModel):
    """One entry of the `metrics` JSONB array. Strict -- unlike `extraction`,
    every metric definition has exactly these five fields today, so a typo
    (e.g. `harness_key` misspelled) should fail loudly rather than silently
    becoming an extra, ignored key.
    """

    model_config = ConfigDict(extra="forbid")

    name: str
    display_name: str
    harness_key: str
    higher_is_better: bool
    is_primary: bool


class StandardDocument(BaseModel):
    """A standards/*.yaml file, validated strictly: a typo in a recipe is
    worse than a crash, because it produces a number nobody questions.

    `extra="forbid"` catches a misspelled key. Every field below is
    required -- the key must be present in the YAML -- except
    `dataset_revision`, `split` and `sample_limit`, which may hold `null`
    per decision D3 and the DB schema's own nullability. "Required but
    nullable" is deliberately `field: T | None` with **no** `= None`
    default: a default would make the *key* optional too, which is exactly
    the silent-default this phase's spec rules out.
    """

    model_config = ConfigDict(extra="forbid")

    label: str
    benchmark: str
    framework: str
    framework_image: str
    task_name: str
    dataset_name: str
    dataset_revision: str | None  # key required; null allowed -- decision D3
    split: str | None  # key required; null allowed
    few_shot: int
    prompt_template: str
    extraction: RecipeExtraction
    metrics: list[RecipeMetricDefinition]
    repeats: int
    sample_limit: int | None  # key required; null allowed
    temperature: float
    top_p: float
    top_k: int
    min_p: float  # decision D4: accepted at any value, never rejected here
    presence_penalty: float
    repetition_penalty: float
    max_tokens: int
    enable_thinking: bool
    think_handling: Literal["strip", "as_is"]

    @model_validator(mode="after")
    def _exactly_one_primary_metric(self) -> "StandardDocument":
        primary_count = sum(metric.is_primary for metric in self.metrics)
        if primary_count != 1:
            raise ValueError(
                f"expected exactly one metric with is_primary=true, found {primary_count}"
            )
        return self

    def as_hashable_dict(self) -> dict[str, Any]:
        """Every field that can change what this recipe measures -- and
        nothing else. Must stay in sync with `Recipe.as_hashable_dict()`
        (app/models/recipe.py): the two are computed from different
        objects (a freshly-validated document vs. a stored row) but must
        produce byte-identical dicts for the same recipe, or a reload
        would mint a second row for content that already has one
        (Trap T1, docs/IMPLEMENTATION_PHASES.md Phase 2).
        """
        return {
            "benchmark": self.benchmark,
            "framework": self.framework,
            "framework_image": self.framework_image,
            "task_name": self.task_name,
            "dataset_name": self.dataset_name,
            "dataset_revision": self.dataset_revision,
            "split": self.split,
            "few_shot": self.few_shot,
            "prompt_template": self.prompt_template,
            "extraction": self.extraction.model_dump(),
            "metrics": [metric.model_dump() for metric in self.metrics],
            "repeats": self.repeats,
            "sample_limit": self.sample_limit,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "top_k": self.top_k,
            "min_p": self.min_p,
            "presence_penalty": self.presence_penalty,
            "repetition_penalty": self.repetition_penalty,
            "max_tokens": self.max_tokens,
            "enable_thinking": self.enable_thinking,
            "think_handling": self.think_handling,
        }


class RecipeFieldWarning(BaseModel):
    """A recipe field whose value is recorded but has no effect for this
    recipe's framework -- e.g. a non-zero `min_p` under evalscope (decision
    D4; see app/services/standards/capabilities.py). Surfaced next to the
    field on the Standards page rather than hidden or rejected at load
    time.
    """

    field: str
    message: str


class StandardRecipe(BaseModel):
    """One row from `recipe` where `label IS NOT NULL`, plus the two things
    the table itself can't hold: per-field capability warnings (computed
    from the row, not stored) and the recipe's own YAML source text
    (re-read from STANDARDS_DIR by label, not stored -- see the Phase 2
    plan's source-rendering decision).
    """

    id: int
    hash: str
    label: str
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
    source_yaml: str | None
