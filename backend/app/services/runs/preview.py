"""Read-only dry run for POST /runs (docs/IMPLEMENTATION_PHASES.md Phase
6; docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3). Mirrors submit.py's
own grid resolution -- same checkpoint/standard loading, same S-D9
sampling-profile fallback chain, same compatibility validator -- but
never calls `resolve_standard` or `resolve_sampling_profile` (both
insert a row) and never creates a run_group or eval_run rows. It exists
at all because compatibility findings and decision D4's warnings all
need `ServingProfile` and `Checkpoint` fields (`max_model_len`,
`reasoning_parser`, `availability_status`, ...) the browser can't see;
duplicating those rules in TypeScript would let the Submit page and the
Standards page disagree about what a value does.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint, SamplingProfile, ServingProfile, Standard
from app.schemas.runs import (
    FieldChange,
    ResolvedSamplingPreview,
    ResolvedServingPreview,
    ResolvedStandardPreview,
    RunPreview,
    RunPreviewPair,
)
from app.services.compatibility.validator import validate_compatibility
from app.services.runs.comparison import comparison_hash
from app.services.runs.submit import (
    load_base_sampling_profiles_by_checkpoint,
    load_base_standards,
    load_checkpoints_and_profiles,
    merge_sampling_config,
    merge_serving_config,
    transient_serving_profile,
)
from app.services.sampling_profiles import queries as sampling_profiles_queries
from app.services.sampling_profiles.hashing import sampling_profile_hash
from app.services.serving_profiles import queries as serving_profiles_queries
from app.services.serving_profiles.hashing import serving_profile_hash
from app.services.standards import queries as standards_queries
from app.services.standards.capabilities import sampling_field_warnings
from app.services.standards.hashing import standard_hash


async def preview_runs(
    db: AsyncSession,
    checkpoint_ids: list[int],
    standard_ids: list[int],
    standard_overrides_by_standard_id: dict[int, dict[str, Any]],
    sampling_overrides_by_checkpoint_id: dict[int, dict[str, Any]],
    sampling_profile_id_by_checkpoint_id: dict[int, int],
    serving_overrides_by_checkpoint_id: dict[int, dict[str, Any]],
    serving_profile_id_by_checkpoint_id: dict[int, int],
) -> RunPreview | None:
    """None if a checkpoint_id, standard_id, or an explicitly named
    sampling or serving profile doesn't exist, so the router 404s --
    the same contract as submit_runs. Reports errors and warnings per
    pair instead of raising on the first one: a 3x6 grid with one bad
    pair should still show the other 17.
    """
    checkpoints_and_profiles = await load_checkpoints_and_profiles(
        db, checkpoint_ids, serving_profile_id_by_checkpoint_id
    )
    if checkpoints_and_profiles is None:
        return None

    base_standards = await load_base_standards(db, standard_ids)
    if base_standards is None:
        return None

    base_sampling_profile_by_checkpoint_id = await load_base_sampling_profiles_by_checkpoint(
        db, checkpoints_and_profiles, sampling_profile_id_by_checkpoint_id
    )
    if base_sampling_profile_by_checkpoint_id is None:
        return None

    # Merged once per checkpoint, not per (checkpoint, standard) pair --
    # see submit.py's own merge_serving_config docstring: nothing about
    # a standard feeds into serving.
    serving_config_by_checkpoint_id: dict[int, dict[str, Any]] = {
        checkpoint.id: merge_serving_config(
            base_serving_profile, serving_overrides_by_checkpoint_id.get(checkpoint.id, {})
        )
        for checkpoint, base_serving_profile in checkpoints_and_profiles
    }
    merged_serving_profile_by_checkpoint_id: dict[int, ServingProfile] = {
        checkpoint_id: transient_serving_profile(config)
        for checkpoint_id, config in serving_config_by_checkpoint_id.items()
    }

    resolved_serving: list[ResolvedServingPreview] = [
        await _preview_resolved_serving(
            db, checkpoint, base_serving_profile, serving_config_by_checkpoint_id[checkpoint.id]
        )
        for checkpoint, base_serving_profile in checkpoints_and_profiles
    ]

    pairs: list[RunPreviewPair] = []
    resolved_standards: list[ResolvedStandardPreview] = []
    resolved_sampling: list[ResolvedSamplingPreview] = []
    for base_standard in base_standards:
        standard_config = base_standard.as_hashable_dict() | standard_overrides_by_standard_id.get(
            base_standard.id, {}
        )
        resolved_standard = await _preview_resolved_standard(db, base_standard, standard_config)
        resolved_standards.append(resolved_standard)
        for checkpoint, _base_serving_profile in checkpoints_and_profiles:
            base_sampling_profile = base_sampling_profile_by_checkpoint_id[checkpoint.id]
            sampling_config = merge_sampling_config(
                base_sampling_profile,
                base_standard,
                sampling_overrides_by_checkpoint_id.get(checkpoint.id, {}),
            )
            # Computed before the pair below so its comparison_hash can
            # be included -- Phase 8 shows the value that decides
            # leaderboard grouping before the run, not only after.
            resolved_sampling_preview = await _preview_resolved_sampling(
                db, checkpoint, base_standard, base_sampling_profile, sampling_config
            )
            resolved_sampling.append(resolved_sampling_preview)
            pairs.append(
                _preview_pair(
                    checkpoint,
                    base_standard,
                    standard_config,
                    sampling_config,
                    merged_serving_profile_by_checkpoint_id[checkpoint.id],
                    comparison_hash(resolved_standard.hash, resolved_sampling_preview.hash),
                )
            )

    # T1: GPUs are counted per distinct checkpoint, not per run -- a
    # submit of one checkpoint against six benchmarks shares one server.
    # Two checkpoints on the same serving profile still count twice,
    # since each one gets its own endpoint. Summed over the *merged*
    # profile (post serving_overrides), not the base one, so a gpus
    # override moves this number before anything submits -- the same
    # reason resolved_serving carries its own `gpus` field.
    gpu_count = sum(profile.gpus for profile in merged_serving_profile_by_checkpoint_id.values())

    return RunPreview(
        run_count=len(pairs),
        gpu_count=gpu_count,
        pairs=pairs,
        resolved_standards=resolved_standards,
        resolved_sampling=resolved_sampling,
        resolved_serving=resolved_serving,
    )


def _preview_pair(
    checkpoint: Checkpoint,
    base_standard: Standard,
    standard_config: dict[str, Any],
    sampling_config: dict[str, Any],
    serving_profile: ServingProfile,
    pair_comparison_hash: str,
) -> RunPreviewPair:
    report = validate_compatibility(checkpoint, serving_profile, standard_config, sampling_config)
    return RunPreviewPair(
        checkpoint_id=checkpoint.id,
        checkpoint_name=checkpoint.name,
        standard_id=base_standard.id,
        standard_label=base_standard.label,
        benchmark=standard_config["benchmark"],
        errors=report.errors,
        warnings=report.warnings,
        # Joined from `errors` the same way submit.py itself joins them
        # before raising SubmitValidationError (R-T20): the preview a
        # user read must match the error a real submit would 400 with.
        blocking_error=(
            "; ".join(finding.message for finding in report.errors) if report.errors else None
        ),
        comparison_hash=pair_comparison_hash,
    )


async def _preview_resolved_standard(
    db: AsyncSession, base_standard: Standard, standard_config: dict[str, Any]
) -> ResolvedStandardPreview:
    """What resolve_standard (app.services.standards.resolve) would do
    for this base standard plus these overrides, computed without its
    insert-on-miss side effect: the same hash function and the same
    by-hash lookup it uses internally, stopping short of the insert.
    """
    hash_value = standard_hash(standard_config)
    existing = await standards_queries.get_standard_by_hash(db, hash_value)

    base_config = base_standard.as_hashable_dict()
    changed_fields = [
        FieldChange(
            field=field, base_value=base_config[field], override_value=standard_config[field]
        )
        for field in base_config
        if base_config[field] != standard_config[field]
    ]

    return ResolvedStandardPreview(
        base_standard_id=base_standard.id,
        hash=hash_value,
        is_new_standard=existing is None,
        changed_fields=changed_fields,
    )


async def _preview_resolved_sampling(
    db: AsyncSession,
    checkpoint: Checkpoint,
    base_standard: Standard,
    base_sampling_profile: SamplingProfile,
    sampling_config: dict[str, Any],
) -> ResolvedSamplingPreview:
    """What resolve_sampling_profile would do for this (checkpoint,
    standard) pair, computed the same stop-short-of-insert way
    `_preview_resolved_standard` does above.
    """
    hash_value = sampling_profile_hash(sampling_config)
    existing = await sampling_profiles_queries.get_sampling_profile_by_hash(db, hash_value)

    base_config = base_sampling_profile.as_hashable_dict()
    changed_fields = [
        FieldChange(
            field=field, base_value=base_config[field], override_value=sampling_config[field]
        )
        for field in base_config
        if base_config[field] != sampling_config[field]
    ]

    return ResolvedSamplingPreview(
        checkpoint_id=checkpoint.id,
        standard_id=base_standard.id,
        base_sampling_profile_id=base_sampling_profile.id,
        hash=hash_value,
        is_new_sampling_profile=existing is None,
        changed_fields=changed_fields,
        warnings=sampling_field_warnings(base_standard.framework, sampling_config),
    )


async def _preview_resolved_serving(
    db: AsyncSession,
    checkpoint: Checkpoint,
    base_serving_profile: ServingProfile,
    serving_config: dict[str, Any],
) -> ResolvedServingPreview:
    """What resolve_serving_profile would do for this checkpoint's
    serving override, computed the same stop-short-of-insert way
    `_preview_resolved_standard` does above -- keyed by checkpoint_id
    alone, not a pair, since nothing about a standard feeds into
    serving (see `merge_serving_config`'s own docstring).
    """
    hash_value = serving_profile_hash(serving_config)
    existing = await serving_profiles_queries.get_serving_profile_by_hash(db, hash_value)

    base_config = base_serving_profile.as_hashable_dict()
    changed_fields = [
        FieldChange(
            field=field, base_value=base_config[field], override_value=serving_config[field]
        )
        for field in base_config
        if base_config[field] != serving_config[field]
    ]

    return ResolvedServingPreview(
        checkpoint_id=checkpoint.id,
        base_serving_profile_id=base_serving_profile.id,
        hash=hash_value,
        is_new_serving_profile=existing is None,
        changed_fields=changed_fields,
        gpus=serving_config["gpus"],
    )
