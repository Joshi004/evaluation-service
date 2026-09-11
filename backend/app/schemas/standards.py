"""Pydantic models for validating a standards YAML file on load, and
shaping the GET /api/v1/standards response.

See docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5 for the exact
field set a standard's identity depends on, now that the eight sampling
fields moved to `sampling_profile` (Phase 3).
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.schemas.catalog import CatalogDocument
from app.schemas.sampling_profiles import SamplingProfileConfig


class StandardExtraction(BaseModel):
    """The `extraction` column is "shapeless per benchmark" (DATA_MODEL_V1.md
    Section 3.3) -- only `method` is guaranteed across every benchmark, so
    `extra="allow"` lets a future benchmark's extraction carry whatever
    else it needs without a schema change here.
    """

    model_config = ConfigDict(extra="allow")

    method: str


class StandardMetricDefinition(BaseModel):
    """One entry of the `metrics` JSONB array. Strict -- unlike `extraction`,
    every metric definition has exactly these six fields today, so a typo
    (e.g. `harness_key` misspelled) should fail loudly rather than silently
    becoming an extra, ignored key.
    """

    model_config = ConfigDict(extra="forbid")

    name: str
    display_name: str
    harness_key: str
    higher_is_better: bool
    is_primary: bool
    # The scorer kwargs EvalScope reads from a dict-shaped `metric_list`
    # entry (`BenchmarkMeta.get_metric_args`) -- e.g. GSM8K's registered
    # `{'acc': {'numeric': True}}`, which switches `Accuracy` from exact
    # string match to `math_equal()`. Defaults to `{}`: every metric that
    # registers as a bare string (IFEval, IFBench, GPQA, MMLU-Pro's `acc`)
    # has none, and `_metric_list_entries()` (task_config.py) sends those
    # as plain strings rather than a `{name: {}}` dict, matching how
    # EvalScope's own registrations spell them.
    harness_options: dict[str, Any] = {}


class StandardDocument(CatalogDocument):
    """A catalog/standards/*.yaml file, validated strictly: a typo in a
    standard is worse than a crash, because it produces a number nobody
    questions.

    `extra="forbid"` (inherited from `CatalogDocument`) catches a
    misspelled key. Every field below is required -- the key must be
    present in the YAML -- except `dataset_revision`, `split`,
    `train_split`, `sample_limit` and `few_shot_prompt_template`, which
    may hold `null` per decision D3 and the DB schema's own nullability.
    "Required but nullable" is deliberately `field: T | None` with **no**
    `= None` default: a default would make the *key* optional too, which
    is exactly the silent-default this phase's spec rules out.
    """

    benchmark: str
    framework: str
    framework_image: str
    task_name: str
    dataset_name: str
    dataset_revision: str | None  # key required; null allowed -- decision D3
    split: str | None  # key required; null allowed
    # The few-shot *source* split -- EvalScope's `BenchmarkMeta.train_split`
    # (GSM8K's `train`, MMLU-Pro's `validation`), distinct from `split`
    # above (`eval_split`, what's actually scored). Null for every 0-shot
    # standard, where there's no source to name (Phase 5, S-D29 area).
    train_split: str | None  # key required; null allowed
    few_shot: int
    prompt_template: str
    # `DefaultDataAdapter.format_fewshot_template()` is
    # `self.few_shot_prompt_template.format(fewshot=..., question=...)` --
    # the template actually used once `few_shot > 0`, distinct from
    # `prompt_template` (the 0-shot/per-question template). Null when
    # `few_shot == 0` (nothing to format) or when the adapter overrides
    # `format_fewshot_template` itself and ignores this field entirely
    # (MMLU-Pro) -- both are legitimate, so this stays nullable rather
    # than defaulting to `""` and silently asserting a template that was
    # never registered.
    few_shot_prompt_template: str | None  # key required; null allowed
    extraction: StandardExtraction
    metrics: list[StandardMetricDefinition]
    repeats: int
    sample_limit: int | None  # key required; null allowed
    think_handling: Literal["strip", "as_is"]
    # What this benchmark's own published definition mandates about
    # sampling, merged ahead of a run's own sampling profile pick
    # (S-D4). Defaults to {} -- most standards mandate nothing.
    sampling_overrides: dict[str, Any] = {}
    # Which samples run. Required, no default: an omitted or empty list
    # is not "all subsets," it's a standard that says nothing, and
    # EvalScope would silently substitute its own registered default
    # for a missing subset_list (S-T19) -- the validator below rejects
    # empty explicitly since Pydantic's `list[str]` alone would accept it.
    subsets: list[str]
    # Operational -- not hashed (S-D7; see as_unhashed_dict below).
    eval_batch_size: int
    request_timeout_seconds: int

    @field_validator("subsets")
    @classmethod
    def _subsets_must_not_be_empty(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError(
                "subsets must not be empty -- an empty list silently falls back to EvalScope's "
                "own registered default subset instead of naming one explicitly (S-T19)"
            )
        return value

    @field_validator("sampling_overrides")
    @classmethod
    def _sampling_overrides_keys_are_known(cls, value: dict[str, Any]) -> dict[str, Any]:
        """S-D22: an unknown key here is a typo that would otherwise
        silently produce a resolved sampling profile with a phantom
        field, discovered (if ever) only by someone diffing a run's
        resolved config against what they expected.
        """
        unknown_keys = sorted(set(value) - set(SamplingProfileConfig.model_fields))
        if unknown_keys:
            raise ValueError(
                f"sampling_overrides has unknown key(s) {unknown_keys} -- must be a subset of "
                f"{sorted(SamplingProfileConfig.model_fields)}"
            )
        return value

    @model_validator(mode="after")
    def _exactly_one_primary_metric(self) -> "StandardDocument":
        primary_count = sum(metric.is_primary for metric in self.metrics)
        if primary_count != 1:
            raise ValueError(
                f"expected exactly one metric with is_primary=true, found {primary_count}"
            )
        return self

    def as_hashable_dict(self) -> dict[str, Any]:
        """Every field that can change what this standard measures --
        and nothing else. Must stay in sync with `Standard.as_hashable_dict()`
        (app/models/standard.py): the two are computed from different
        objects (a freshly-validated document vs. a stored row) but must
        produce byte-identical dicts for the same standard, or a reload
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
            "train_split": self.train_split,
            "few_shot": self.few_shot,
            "prompt_template": self.prompt_template,
            "few_shot_prompt_template": self.few_shot_prompt_template,
            "extraction": self.extraction.model_dump(),
            "metrics": [metric.model_dump() for metric in self.metrics],
            "repeats": self.repeats,
            "sample_limit": self.sample_limit,
            "think_handling": self.think_handling,
            "sampling_overrides": self.sampling_overrides,
            "subsets": self.subsets,
        }

    def as_unhashed_dict(self) -> dict[str, Any]:
        """`eval_batch_size` and `request_timeout_seconds` (S-D7): stored
        on the row but never part of `standard.hash`, because neither can
        change what gets measured -- only how fast or how patiently the
        measurement runs. The catalog loader's `sync_unhashed_columns`
        writes these back onto an existing row even when the hash already
        matched, which is how editing one in the YAML and reloading
        updates the row in place instead of doing nothing.
        """
        return {
            "eval_batch_size": self.eval_batch_size,
            "request_timeout_seconds": self.request_timeout_seconds,
        }


class SamplingFieldWarning(BaseModel):
    """A sampling field whose value is recorded but has no effect under
    a given framework -- e.g. a non-zero `min_p` under evalscope
    (decision D4; see app/services/standards/capabilities.py). Computed
    by the backend, not stored, and surfaced next to the field wherever
    a standard or a run's resolved sampling profile is shown to a human:
    the Standards page, the Submit dry-run preview, and a run's detail
    page all need the exact same warning text, which is why this lives
    here rather than in each caller's own schema module.
    """

    field: str
    message: str


class StandardSummary(BaseModel):
    """One row from `standard` where `label IS NOT NULL` (or every row,
    when the Standards page asks for ad-hoc ones too), plus the two
    things the table itself can't hold: decision D4's warnings for
    whatever sampling this standard's own `sampling_overrides` mandates,
    and the standard's raw YAML source text (re-read from
    `catalog/standards/` by label, not stored -- see the Phase 2 plan's
    source-rendering decision). `source_yaml` is `None` for an ad-hoc
    row: it was minted from a submit-time override, not loaded from a
    file.
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
    warnings: list[SamplingFieldWarning]
    source_yaml: str | None
