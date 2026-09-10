"""Checkpoint registration -- the write path. See
docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 5, item 2, and (the
sampling-profile fallback) docs/STANDARDS_AND_PROFILES_PHASES.md
Phase 2, item 8.

The cheap database checks run first and commit before the one SSH round
trip this flow makes (R-T17): duplicate name, duplicate path, an
existing profile id, and a parent's ancestry are all plain reads, so
failing fast on any of them costs nothing beyond what the request
already paid. `resolve_serving_profile` is the one call in this flow
that can write (R-T18) -- it runs only after every other check,
including the inspection's own readability, has passed, so a rejected
registration never leaves an orphan profile behind for a reason this
module could have caught first.
"""

import logging

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.checkpoints import CheckpointDetail, RegisterCheckpointRequest
from app.schemas.discovery import CheckpointInspection
from app.services.checkpoints import queries as checkpoints_queries
from app.services.checkpoints.recommendation import recommend_sampling_profile
from app.services.cluster import get_model_discovery
from app.services.discovery.references import validate_reference
from app.services.sampling_profiles import queries as sampling_profiles_queries
from app.services.serving_profiles import queries as serving_profiles_queries
from app.services.serving_profiles.resolve import resolve_serving_profile

logger = logging.getLogger(__name__)

# "20 is plenty" (R-T16) -- nothing in the schema stops a cycle, so the
# walk below needs a hard stop of its own regardless of whether it also
# finds a repeat.
_MAX_LINEAGE_DEPTH = 20


class UnreadableCheckpointError(Exception):
    """A fresh inspection could not read config.json -- registering
    something we cannot read has no upside. The router maps this to 400.
    """


class RegistrationTargetNotFoundError(Exception):
    """An `existing_profile_id` or `parent_checkpoint_id` that names no
    row. The router maps this to 404.
    """


class CheckpointConflictError(Exception):
    """A duplicate name, a duplicate path (R-D23), or a parent whose own
    ancestry is already cyclic or too deep (R-T16). The router maps this
    to 409.
    """


async def register_checkpoint(
    db: AsyncSession, request: RegisterCheckpointRequest
) -> CheckpointDetail:
    """Validate, inspect fresh, resolve the profile, then insert -- in
    that order, and never the profile step before everything else has
    passed (R-T18). Raises `InvalidReferenceError` (from
    `validate_reference`), `UnreadableCheckpointError`,
    `RegistrationTargetNotFoundError`, or `CheckpointConflictError`; the
    router maps each to its status code.
    """
    validated_reference = validate_reference(request.reference)

    await _reject_duplicate_name(db, request.name)
    await _reject_duplicate_path(db, validated_reference)
    if request.serving_profile.existing_profile_id is not None:
        await _assert_profile_exists(db, request.serving_profile.existing_profile_id)
    if request.sampling_profile_id is not None:
        await _assert_sampling_profile_exists(db, request.sampling_profile_id)
    if request.parent_checkpoint_id is not None:
        await _assert_parent_lineage_is_healthy(db, request.parent_checkpoint_id)

    # Every check above is a plain SELECT -- close the read transaction
    # before the SSH call below rather than holding it open across a
    # round trip that can take seconds (R-T17).
    await db.commit()

    discovery = get_model_discovery()
    inspection = await discovery.inspect_checkpoint(validated_reference)
    if not inspection.readable:
        raise UnreadableCheckpointError(
            f"{validated_reference} could not be read: {'; '.join(inspection.problems)}"
        )

    if request.serving_profile.existing_profile_id is not None:
        default_serving_profile_id = request.serving_profile.existing_profile_id
    else:
        # Guaranteed by ServingProfileSelection's model_validator: exactly
        # one of the two fields is set.
        assert request.serving_profile.customised is not None
        resolved_profile = await resolve_serving_profile(db, request.serving_profile.customised)
        default_serving_profile_id = resolved_profile.id

    if request.sampling_profile_id is not None:
        default_sampling_profile_id = request.sampling_profile_id
    else:
        # S-D9: omitting sampling_profile_id means "the checkpoint's
        # recommended default" -- computed here, server-side, rather
        # than surfaced through a picker, because Phase 2 ships with no
        # sampling UI at all (Phase 8 adds one as a pure enhancement).
        default_sampling_profile_id = await _recommend_default_sampling_profile_id(db, inspection)

    try:
        checkpoint = await checkpoints_queries.insert_checkpoint(
            db,
            name=request.name,
            path=inspection.reference,
            family=request.family,
            parent_checkpoint_id=request.parent_checkpoint_id,
            default_serving_profile_id=default_serving_profile_id,
            default_sampling_profile_id=default_sampling_profile_id,
            registered_by=request.registered_by,
            inspection=inspection,
        )
    except IntegrityError as exc:
        await db.rollback()
        # `name` is the only UNIQUE constraint on this table (R-T19) --
        # the pre-check above still races, so this is the backstop. If
        # `resolve_serving_profile` minted a new ad-hoc profile row just
        # above and then lost this race, that row is now an orphan: an
        # accepted, unavoidable gap (R-T18) rather than one this phase
        # closes, since closing it would mean holding a lock across the
        # whole flow.
        logger.warning(
            "checkpoint insert raced the name-uniqueness constraint for name=%r: %s",
            request.name,
            exc,
        )
        raise CheckpointConflictError(
            f"a checkpoint named {request.name!r} already exists"
        ) from exc

    registered_checkpoint = await checkpoints_queries.get_checkpoint_with_runs(db, checkpoint.id)
    assert registered_checkpoint is not None  # just inserted in this same transaction
    return registered_checkpoint


async def _reject_duplicate_name(db: AsyncSession, name: str) -> None:
    existing = await checkpoints_queries.get_checkpoint_by_name(db, name)
    if existing is not None:
        raise CheckpointConflictError(
            f"a checkpoint named {name!r} already exists (id={existing.id})"
        )


async def _reject_duplicate_path(db: AsyncSession, validated_reference: str) -> None:
    """R-D23: two names for one directory would produce two leaderboard
    entries for one model, so this is a 409 naming the existing row
    rather than a second insert.
    """
    existing = await checkpoints_queries.get_checkpoint_by_path(db, validated_reference)
    if existing is not None:
        raise CheckpointConflictError(
            f"{validated_reference} is already registered as checkpoint id={existing.id}"
        )


async def _assert_profile_exists(db: AsyncSession, serving_profile_id: int) -> None:
    profile = await serving_profiles_queries.get_serving_profile(db, serving_profile_id)
    if profile is None:
        raise RegistrationTargetNotFoundError(f"serving profile {serving_profile_id} not found")


async def _assert_sampling_profile_exists(db: AsyncSession, sampling_profile_id: int) -> None:
    profile = await sampling_profiles_queries.get_sampling_profile(db, sampling_profile_id)
    if profile is None:
        raise RegistrationTargetNotFoundError(f"sampling profile {sampling_profile_id} not found")


async def _recommend_default_sampling_profile_id(
    db: AsyncSession, inspection: CheckpointInspection
) -> int:
    """The service-layer fallback S-D9 requires when `sampling_profile_id`
    is omitted from the request -- mirrors the reuse-by-model_type read
    `inspect_checkpoint_candidate` (app/controllers/checkpoints.py) does
    for serving profiles, but computed here directly since there is no
    picker step in between for sampling yet.
    """
    profiles = await sampling_profiles_queries.list_sampling_profiles(db)
    profile_ids_for_same_model_type: list[int] = []
    if inspection.model_type is not None:
        profile_ids_for_same_model_type = (
            await checkpoints_queries.list_default_sampling_profile_ids_for_model_type(
                db, inspection.model_type
            )
        )
    recommendation = recommend_sampling_profile(
        inspection, profiles, profile_ids_for_same_model_type
    )
    # The migration seeds `greedy` and nothing in Phase 2 can delete it
    # (Phase 6 adds deletion) -- recommend_sampling_profile always falls
    # back to it, so `profile` is never actually None here.
    assert recommendation.profile is not None
    return recommendation.profile.id


async def _assert_parent_lineage_is_healthy(db: AsyncSession, parent_checkpoint_id: int) -> None:
    """Confirms `parent_checkpoint_id` exists, then walks its ancestry
    upward with a visited set and the depth cap above (R-T16). A
    brand-new row can never close a cycle back to itself -- it has no id
    yet for anything to point at -- so what this genuinely guards
    against is a chain that was already corrupt (by direct SQL, say)
    before this registration ever ran.
    """
    parent = await checkpoints_queries.get_checkpoint(db, parent_checkpoint_id)
    if parent is None:
        raise RegistrationTargetNotFoundError(f"parent checkpoint {parent_checkpoint_id} not found")

    visited = {parent_checkpoint_id}
    next_id = parent.parent_checkpoint_id
    while next_id is not None:
        if next_id in visited:
            raise CheckpointConflictError(
                f"parent checkpoint {parent_checkpoint_id} has a cyclic ancestry"
            )
        if len(visited) >= _MAX_LINEAGE_DEPTH:
            raise CheckpointConflictError(
                f"parent checkpoint {parent_checkpoint_id}'s ancestry exceeds the "
                f"{_MAX_LINEAGE_DEPTH}-checkpoint depth cap"
            )
        visited.add(next_id)
        next_checkpoint = await checkpoints_queries.get_checkpoint(db, next_id)
        if next_checkpoint is None:
            break  # the FK should make this impossible; treat it as the chain's end
        next_id = next_checkpoint.parent_checkpoint_id
