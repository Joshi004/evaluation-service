"""POST /runs' whole submit path (docs/IMPLEMENTATION_PHASES.md Phase 5,
item 1; docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3): validate every
(checkpoint, standard) pair in the submitted grid up front, resolve each
standard, each pair's sampling profile, and each checkpoint's serving
profile only if every pair passes, then create one run_group and one
queued eval_run per pair.

Validating before resolving is deliberate: resolve_standard,
resolve_sampling_profile, and resolve_serving_profile each mint a new,
immutable row the moment an override's content is new, so a rejected
submit must never leave one behind. The two label pre-flight checks
below (`_require_labels_available`,
`_require_one_sampling_hash_per_labelled_checkpoint`) run for the same
reason: a requested label that would collide with an existing row, or
that would have to name more than one distinct row, must 400 before any
of the three resolve calls runs, not surface as a bare IntegrityError --
or a silently mis-labelled row -- partway through.
"""

from collections.abc import Awaitable, Callable
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkpoint, SamplingProfile, ServingProfile, Standard
from app.schemas.runs import RunSubmission
from app.schemas.serving_profiles import ServingProfileConfig
from app.services.checkpoints import queries as checkpoints_queries
from app.services.compatibility.validator import validate_compatibility
from app.services.endpoints import queries as endpoints_queries
from app.services.runs import queries as runs_queries
from app.services.runs.comparison import comparison_hash
from app.services.runs.queries import QueuedEvalRun
from app.services.sampling_profiles import queries as sampling_profiles_queries
from app.services.sampling_profiles.hashing import sampling_profile_hash
from app.services.sampling_profiles.resolve import resolve_sampling_profile
from app.services.serving_profiles import queries as serving_profiles_queries
from app.services.serving_profiles.hashing import serving_profile_hash
from app.services.serving_profiles.resolve import resolve_serving_profile
from app.services.standards import queries as standards_queries
from app.services.standards.hashing import standard_hash
from app.services.standards.resolve import resolve_standard


class SubmitValidationError(Exception):
    """A submit that would fail predictably -- minutes into a cold start
    -- rather than at request time. The router maps this to a 400.
    """


async def load_checkpoints_and_profiles(
    db: AsyncSession,
    checkpoint_ids: list[int],
    serving_profile_id_by_checkpoint_id: dict[int, int],
) -> list[tuple[Checkpoint, ServingProfile]] | None:
    """None if any checkpoint_id doesn't exist, or an explicitly named
    serving profile doesn't exist, so the caller's router can 404.
    Shared with `preview.py`'s read-only `preview_runs` (Phase 6) so the
    two can never resolve a grid's checkpoints differently.

    S-D9's fallback chain for the serving axis, mirroring
    `load_base_sampling_profiles_by_checkpoint` below: a checkpoint with
    an explicit entry in `serving_profile_id_by_checkpoint_id` uses that
    profile; every other checkpoint falls back to its own
    `default_serving_profile_id` (never a third fallback -- the column
    is `NOT NULL`, so there is always a profile to fall back to). Each
    returned tuple's `ServingProfile` is that checkpoint's *base* --
    callers merge in `serving_overrides_by_checkpoint_id` themselves
    (`merge_serving_config`), the same way they already merge sampling.
    """
    checkpoints_and_profiles: list[tuple[Checkpoint, ServingProfile]] = []
    for checkpoint_id in checkpoint_ids:
        override_profile_id = serving_profile_id_by_checkpoint_id.get(checkpoint_id)
        if override_profile_id is None:
            checkpoint_and_profile = await endpoints_queries.get_checkpoint_and_serving_profile(
                db, checkpoint_id
            )
            if checkpoint_and_profile is None:
                return None
            checkpoints_and_profiles.append(checkpoint_and_profile)
            continue

        checkpoint = await checkpoints_queries.get_checkpoint(db, checkpoint_id)
        serving_profile = await serving_profiles_queries.get_serving_profile(
            db, override_profile_id
        )
        if checkpoint is None or serving_profile is None:
            return None
        checkpoints_and_profiles.append((checkpoint, serving_profile))
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
    sampling_profile_id_by_checkpoint_id: dict[int, int],
) -> dict[int, SamplingProfile] | None:
    """S-D9's fallback chain, resolved once per checkpoint: a checkpoint
    with an explicit entry in `sampling_profile_id_by_checkpoint_id`
    uses that profile; every other checkpoint falls back to its own
    `default_sampling_profile_id` (never a third fallback --
    `default_sampling_profile_id` is `NOT NULL`, so there is always a
    profile to fall back to). None if an explicitly named profile
    doesn't exist, so the caller's router can 404 like a bad
    checkpoint_id or standard_id.
    """
    base_sampling_profile_by_checkpoint_id: dict[int, SamplingProfile] = {}
    for checkpoint, _base_serving_profile in checkpoints_and_profiles:
        profile_id = sampling_profile_id_by_checkpoint_id.get(
            checkpoint.id, checkpoint.default_sampling_profile_id
        )
        base_sampling_profile = await sampling_profiles_queries.get_sampling_profile(db, profile_id)
        if base_sampling_profile is None:
            return None
        base_sampling_profile_by_checkpoint_id[checkpoint.id] = base_sampling_profile
    return base_sampling_profile_by_checkpoint_id


class _HashedRow(Protocol):
    """What `_require_labels_available` needs from an existing row,
    regardless of which of the three tables it came from -- structural,
    not `Standard | SamplingProfile | ServingProfile`, so that function
    stays one implementation shared by all three axes.
    """

    hash: str


async def _require_labels_available(
    db: AsyncSession,
    *,
    label_by_id: dict[int, str],
    hash_by_id: dict[int, str],
    get_existing_by_label: Callable[[AsyncSession, str], Awaitable[_HashedRow | None]],
    dict_name: str,
) -> None:
    """Every requested label must be free to take: not already on a row
    with different content (S-D3's UNIQUE constraint, checked here so a
    bad request 400s with an actionable message instead of surfacing as
    a bare IntegrityError deep inside an insert), and not requested for
    two different pieces of content within this one submit. The same
    label requested twice for the *same* content is fine -- both ids
    resolve to the one row that already owns it, labelled once.
    """
    content_hash_by_label: dict[str, str] = {}
    for entry_id, label in label_by_id.items():
        content_hash = hash_by_id[entry_id]
        first_hash_for_label = content_hash_by_label.setdefault(label, content_hash)
        if first_hash_for_label != content_hash:
            raise SubmitValidationError(
                f"{dict_name} requests label {label!r} for more than one distinct value "
                "in this submit -- one label cannot name two different rows"
            )

        existing = await get_existing_by_label(db, label)
        if existing is not None and existing.hash != content_hash:
            raise SubmitValidationError(
                f"{dict_name} requests label {label!r}, already taken by an existing row "
                "with different content"
            )


def _require_one_sampling_hash_per_labelled_checkpoint(
    sampling_label_by_checkpoint_id: dict[int, str],
    sampling_hash_by_checkpoint_and_standard: dict[tuple[int, int], str],
    base_standards: list[Standard],
    checkpoint_name_by_id: dict[int, str],
) -> None:
    """A checkpoint's sampling label is one label for one card, but a
    standard whose own `sampling_overrides` genuinely changes the merged
    config (S-D4's middle layer) can still make that checkpoint resolve
    to more than one distinct sampling profile across the selected
    standards -- today's five shipped standards never do (all set
    `sampling_overrides: {}`), but nothing stops a future one. One label
    cannot name two different rows, so this rejects the submit and names
    which standards caused the split, rather than silently attaching the
    label to only the first one resolved or inventing a second name no
    one asked for.
    """
    for checkpoint_id, label in sampling_label_by_checkpoint_id.items():
        standard_names_by_hash: dict[str, list[str]] = {}
        for standard in base_standards:
            hash_value = sampling_hash_by_checkpoint_and_standard[(checkpoint_id, standard.id)]
            standard_names_by_hash.setdefault(hash_value, []).append(
                standard.label or standard.benchmark
            )
        if len(standard_names_by_hash) <= 1:
            continue
        groups = "; ".join(
            f"{', '.join(names)} -> {hash_value}"
            for hash_value, names in standard_names_by_hash.items()
        )
        raise SubmitValidationError(
            f"sampling_label_by_checkpoint_id names {label!r} for checkpoint "
            f"{checkpoint_name_by_id[checkpoint_id]!r}, but the selected standards' own "
            f"sampling_overrides resolve its sampling to {len(standard_names_by_hash)} "
            f"different profiles ({groups}) -- one label cannot name more than one profile"
        )


async def submit_runs(
    db: AsyncSession,
    name: str,
    checkpoint_ids: list[int],
    standard_ids: list[int],
    standard_overrides_by_standard_id: dict[int, dict[str, Any]],
    sampling_overrides_by_checkpoint_id: dict[int, dict[str, Any]],
    sampling_profile_id_by_checkpoint_id: dict[int, int],
    serving_overrides_by_checkpoint_id: dict[int, dict[str, Any]],
    serving_profile_id_by_checkpoint_id: dict[int, int],
    standard_label_by_standard_id: dict[int, str],
    sampling_label_by_checkpoint_id: dict[int, str],
    serving_label_by_checkpoint_id: dict[int, str],
    submitted_by: str | None,
) -> RunSubmission | None:
    """Returns None if a checkpoint_id, standard_id, or an explicitly
    named sampling or serving profile doesn't exist, so the router 404s.
    Raises SubmitValidationError for a pair that cannot run as
    requested, or a label that cannot be honoured as requested.
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

    standard_config_by_base_id: dict[int, dict[str, Any]] = {
        base_standard.id: (
            base_standard.as_hashable_dict()
            | standard_overrides_by_standard_id.get(base_standard.id, {})
        )
        for base_standard in base_standards
    }
    # Merged once per checkpoint, not per (checkpoint, standard) pair --
    # nothing about a standard feeds into serving, unlike sampling's
    # standard.sampling_overrides layer, so this is the same for every
    # pair a given checkpoint appears in.
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

    # Validate the whole grid before resolving anything -- see module
    # docstring. Each pair's sampling hash is recorded along the way
    # (not just used for validation) so the label pre-flight checks
    # below can run without a second pass over the grid.
    sampling_hash_by_checkpoint_and_standard: dict[tuple[int, int], str] = {}
    for base_standard in base_standards:
        standard_config = standard_config_by_base_id[base_standard.id]
        for checkpoint, _base_serving_profile in checkpoints_and_profiles:
            sampling_config = merge_sampling_config(
                base_sampling_profile_by_checkpoint_id[checkpoint.id],
                base_standard,
                sampling_overrides_by_checkpoint_id.get(checkpoint.id, {}),
            )
            sampling_hash_by_checkpoint_and_standard[(checkpoint.id, base_standard.id)] = (
                sampling_profile_hash(sampling_config)
            )
            report = validate_compatibility(
                checkpoint,
                merged_serving_profile_by_checkpoint_id[checkpoint.id],
                standard_config,
                sampling_config,
            )
            if report.status == "invalid":
                raise SubmitValidationError("; ".join(finding.message for finding in report.errors))

    _require_one_sampling_hash_per_labelled_checkpoint(
        sampling_label_by_checkpoint_id,
        sampling_hash_by_checkpoint_and_standard,
        base_standards,
        checkpoint_name_by_id={
            checkpoint.id: checkpoint.name for checkpoint, _ in checkpoints_and_profiles
        },
    )

    await _require_labels_available(
        db,
        label_by_id=standard_label_by_standard_id,
        hash_by_id={
            base_standard.id: standard_hash(standard_config_by_base_id[base_standard.id])
            for base_standard in base_standards
        },
        get_existing_by_label=standards_queries.get_standard_by_label,
        dict_name="standard_label_by_standard_id",
    )
    await _require_labels_available(
        db,
        label_by_id=sampling_label_by_checkpoint_id,
        # Reads the first selected standard's hash for each checkpoint,
        # not all of them -- safe by construction:
        # _require_one_sampling_hash_per_labelled_checkpoint above
        # already rejected any labelled checkpoint whose selected
        # standards resolve it to more than one distinct hash, so every
        # standard's hash is the same one for a labelled checkpoint by
        # the time this runs.
        hash_by_id={
            checkpoint_id: sampling_hash_by_checkpoint_and_standard[
                (checkpoint_id, base_standards[0].id)
            ]
            for checkpoint_id in sampling_label_by_checkpoint_id
        },
        get_existing_by_label=sampling_profiles_queries.get_sampling_profile_by_label,
        dict_name="sampling_label_by_checkpoint_id",
    )
    await _require_labels_available(
        db,
        label_by_id=serving_label_by_checkpoint_id,
        hash_by_id={
            checkpoint_id: profile.hash
            for checkpoint_id, profile in merged_serving_profile_by_checkpoint_id.items()
        },
        get_existing_by_label=serving_profiles_queries.get_serving_profile_by_label,
        dict_name="serving_label_by_checkpoint_id",
    )

    resolved_standard_by_base_id: dict[int, Standard] = {}
    for base_standard in base_standards:
        resolved_standard_by_base_id[base_standard.id] = await resolve_standard(
            db,
            base_standard,
            standard_overrides_by_standard_id.get(base_standard.id, {}),
            label=standard_label_by_standard_id.get(base_standard.id),
        )

    resolved_serving_profile_by_checkpoint_id: dict[int, ServingProfile] = {}
    for checkpoint, _base_serving_profile in checkpoints_and_profiles:
        resolved_serving_profile_by_checkpoint_id[checkpoint.id] = await resolve_serving_profile(
            db,
            ServingProfileConfig(**serving_config_by_checkpoint_id[checkpoint.id]),
            label=serving_label_by_checkpoint_id.get(checkpoint.id),
        )

    run_group = await runs_queries.create_run_group(db, name, submitted_by)

    queued_runs: list[QueuedEvalRun] = []
    for checkpoint, _base_serving_profile in checkpoints_and_profiles:
        base_sampling_profile = base_sampling_profile_by_checkpoint_id[checkpoint.id]
        resolved_serving_profile = resolved_serving_profile_by_checkpoint_id[checkpoint.id]
        for base_standard in base_standards:
            resolved_standard = resolved_standard_by_base_id[base_standard.id]
            resolved_sampling_profile = await resolve_sampling_profile(
                db,
                base_sampling_profile,
                base_standard.sampling_overrides,
                sampling_overrides_by_checkpoint_id.get(checkpoint.id, {}),
                label=sampling_label_by_checkpoint_id.get(checkpoint.id),
            )
            queued_runs.append(
                QueuedEvalRun(
                    checkpoint_id=checkpoint.id,
                    standard_id=resolved_standard.id,
                    sampling_profile_id=resolved_sampling_profile.id,
                    serving_profile_id=resolved_serving_profile.id,
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


def merge_serving_config(
    base_serving_profile: ServingProfile, serving_overrides: dict[str, Any]
) -> dict[str, Any]:
    """The serving analogue of `merge_sampling_config`, two-layer rather
    than three: what the checkpoint is served under by default (or an
    explicitly picked profile), overridden by what the caller actually
    asked for. No standard-mandated middle layer -- nothing about a
    standard feeds into how a checkpoint is served, unlike sampling's
    `standard.sampling_overrides`. Shared with `preview.py` for the same
    reason `merge_sampling_config` is.
    """
    return base_serving_profile.as_hashable_dict() | serving_overrides


def transient_serving_profile(config: dict[str, Any]) -> ServingProfile:
    """A `ServingProfile` instance built from a merged config but never
    added to the session -- exactly what `validate_compatibility` and
    its six serving rules need to read (`.gpus`, `.max_model_len`, ...)
    off a *resolved* config, without minting a row for a submit that may
    still fail validation, or for a preview that must never mint one at
    all. `serving_profile_display_name` already falls back to `.hash`
    for a profile with no `.label`, so a message built from this reads
    correctly too. Shared with `preview.py` for the same reason
    `merge_serving_config` is.
    """
    return ServingProfile(**config, hash=serving_profile_hash(config))
