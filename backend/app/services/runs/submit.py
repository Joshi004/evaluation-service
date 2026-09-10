"""POST /runs' whole submit path (docs/IMPLEMENTATION_PHASES.md Phase 5,
item 1; docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3): validate every
(checkpoint, standard) pair in the submitted grid up front, resolve each
standard and each pair's sampling profile only if every pair passes,
then create one run_group and one queued eval_run per pair.

Validating before resolving is deliberate: resolve_standard and
resolve_sampling_profile each mint a new, immutable row the moment an
override's content is new, so a rejected submit must never leave one
behind.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint, SamplingProfile, ServingProfile, Standard
from app.schemas.runs import RunSubmission
from app.services.compatibility.validator import validate_compatibility
from app.services.endpoints import queries as endpoints_queries
from app.services.runs import queries as runs_queries
from app.services.runs.comparison import comparison_hash
from app.services.runs.queries import QueuedEvalRun
from app.services.sampling_profiles import queries as sampling_profiles_queries
from app.services.sampling_profiles.resolve import resolve_sampling_profile
from app.services.standards import queries as standards_queries
from app.services.standards.resolve import resolve_standard


class SubmitValidationError(Exception):
    """A submit that would fail predictably -- minutes into a cold start
    -- rather than at request time. The router maps this to a 400.
    """


async def load_checkpoints_and_profiles(
    db: AsyncSession, checkpoint_ids: list[int]
) -> list[tuple[Checkpoint, ServingProfile]] | None:
    """None if any checkpoint_id doesn't exist, so the caller's router
    can 404. Shared with `preview.py`'s read-only `preview_runs` (Phase
    6) so the two can never resolve a grid's checkpoints differently.
    """
    checkpoints_and_profiles: list[tuple[Checkpoint, ServingProfile]] = []
    for checkpoint_id in checkpoint_ids:
        checkpoint_and_profile = await endpoints_queries.get_checkpoint_and_serving_profile(
            db, checkpoint_id
        )
        if checkpoint_and_profile is None:
            return None
        checkpoints_and_profiles.append(checkpoint_and_profile)
    return checkpoints_and_profiles


async def load_base_standards(db: AsyncSession, standard_ids: list[int]) -> list[Standard] | None:
    """None if any standard_id doesn't exist -- see
    `load_checkpoints_and_profiles`, its sibling for the other half of
    the grid.
    """
    base_standards: list[Standard] = []
    for standard_id in standard_ids:
        base_standard = await standards_queries.get_standard(db, standard_id)
        if base_standard is None:
            return None
        base_standards.append(base_standard)
    return base_standards


async def load_base_sampling_profiles_by_checkpoint(
    db: AsyncSession,
    checkpoints_and_profiles: list[tuple[Checkpoint, ServingProfile]],
    sampling_profile_id: int | None,
) -> dict[int, SamplingProfile] | None:
    """S-D9's fallback chain, resolved once per checkpoint: an explicit
    `sampling_profile_id` wins for every checkpoint in the grid
    uniformly; omitted, each checkpoint falls back to its own
    `default_sampling_profile_id` (never a third fallback --
    `default_sampling_profile_id` is `NOT NULL`, so there is always a
    profile to fall back to). None if `sampling_profile_id` was given
    but doesn't exist, so the caller's router can 404 like a bad
    checkpoint_id or standard_id.
    """
    base_sampling_profile_by_checkpoint_id: dict[int, SamplingProfile] = {}
    for checkpoint, _serving_profile in checkpoints_and_profiles:
        profile_id = (
            sampling_profile_id
            if sampling_profile_id is not None
            else checkpoint.default_sampling_profile_id
        )
        base_sampling_profile = await sampling_profiles_queries.get_sampling_profile(db, profile_id)
        if base_sampling_profile is None:
            return None
        base_sampling_profile_by_checkpoint_id[checkpoint.id] = base_sampling_profile
    return base_sampling_profile_by_checkpoint_id


async def submit_runs(
    db: AsyncSession,
    name: str,
    checkpoint_ids: list[int],
    standard_ids: list[int],
    standard_overrides: dict[str, Any],
    sampling_overrides: dict[str, Any],
    sampling_profile_id: int | None,
    submitted_by: str | None,
) -> RunSubmission | None:
    """Returns None if a checkpoint_id, standard_id, or an explicit
    sampling_profile_id doesn't exist, so the router 404s. Raises
    SubmitValidationError for a pair that cannot run as requested.
    """
    checkpoints_and_profiles = await load_checkpoints_and_profiles(db, checkpoint_ids)
    if checkpoints_and_profiles is None:
        return None

    base_standards = await load_base_standards(db, standard_ids)
    if base_standards is None:
        return None

    base_sampling_profile_by_checkpoint_id = await load_base_sampling_profiles_by_checkpoint(
        db, checkpoints_and_profiles, sampling_profile_id
    )
    if base_sampling_profile_by_checkpoint_id is None:
        return None

    # Validate the whole grid before resolving anything -- see module
    # docstring on why a rejected submit must never mint a standard or
    # sampling profile row.
    for base_standard in base_standards:
        standard_config = base_standard.as_hashable_dict() | standard_overrides
        for checkpoint, serving_profile in checkpoints_and_profiles:
            sampling_config = merge_sampling_config(
                base_sampling_profile_by_checkpoint_id[checkpoint.id],
                base_standard,
                sampling_overrides,
            )
            report = validate_compatibility(
                checkpoint, serving_profile, standard_config, sampling_config
            )
            if report.status == "invalid":
                raise SubmitValidationError("; ".join(finding.message for finding in report.errors))

    resolved_standard_by_base_id: dict[int, Standard] = {}
    for base_standard in base_standards:
        resolved_standard_by_base_id[base_standard.id] = await resolve_standard(
            db, base_standard, standard_overrides
        )

    run_group = await runs_queries.create_run_group(db, name, submitted_by)

    queued_runs: list[QueuedEvalRun] = []
    for checkpoint, serving_profile in checkpoints_and_profiles:
        base_sampling_profile = base_sampling_profile_by_checkpoint_id[checkpoint.id]
        for base_standard in base_standards:
            resolved_standard = resolved_standard_by_base_id[base_standard.id]
            resolved_sampling_profile = await resolve_sampling_profile(
                db, base_sampling_profile, base_standard.sampling_overrides, sampling_overrides
            )
            queued_runs.append(
                QueuedEvalRun(
                    checkpoint_id=checkpoint.id,
                    standard_id=resolved_standard.id,
                    sampling_profile_id=resolved_sampling_profile.id,
                    serving_profile_id=serving_profile.id,
                    comparison_hash=comparison_hash(
                        resolved_standard.hash, resolved_sampling_profile.hash
                    ),
                )
            )

    run_ids = await runs_queries.insert_eval_runs(db, run_group.id, queued_runs, submitted_by)
    return RunSubmission(run_group_id=run_group.id, run_ids=run_ids)


def merge_sampling_config(
    base_sampling_profile: SamplingProfile,
    base_standard: Standard,
    sampling_overrides: dict[str, Any],
) -> dict[str, Any]:
    """S-D4's three-layer merge, key by key: what the checkpoint speaks
    like by default (or whichever profile a submit picked explicitly),
    overridden by what the benchmark's standard mandates, overridden by
    what the caller actually asked for. Mirrors
    `resolve_sampling_profile`'s own merge exactly, without its
    insert-on-miss side effect -- shared with `preview.py` so validation
    and a preview's resolved-sampling section can never see a different
    config than a real resolve would produce.
    """
    return (
        base_sampling_profile.as_hashable_dict()
        | base_standard.sampling_overrides
        | sampling_overrides
    )
