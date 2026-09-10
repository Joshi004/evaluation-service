"""Registration's serving- and sampling-profile suggestions -- pure
functions over an inspection and the existing profile rows. No I/O and
no database access here: the controller reads whatever this needs and
passes it in, which is what makes this callable from anywhere and
trivial to reason about in isolation. See
docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 5, item 3 (serving) and
docs/STANDARDS_AND_PROFILES_PHASES.md Phase 2, item 7 (sampling).
"""

from app.schemas.discovery import CheckpointInspection
from app.schemas.sampling_profiles import SamplingProfileRecommendation, SamplingProfileSummary
from app.schemas.serving_profiles import ServingProfileRecommendation, ServingProfileSummary


def recommend_serving_profile(
    inspection: CheckpointInspection,
    profiles: list[ServingProfileSummary],
    profile_ids_for_same_model_type: list[int],
) -> ServingProfileRecommendation:
    """Recommends one of `profiles` for a freshly-inspected checkpoint,
    or `None` with a reason if nothing fits. `reason` is never empty --
    a recommendation the user cannot see the basis for is one they will
    ignore.

    Order:
    1. Exclude any profile whose `max_model_len` exceeds this
       checkpoint's `context_length` -- vLLM refuses to start otherwise.
    2. Prefer a profile already used as the default for a registered
       checkpoint of the same `model_type`: a derived checkpoint
       normally reuses its base's profile.
    3. Fall back to a labelled profile whose `reasoning_parser` matches
       this checkpoint's `model_type` (e.g. a Qwen3 checkpoint and the
       `qwen3` reasoning parser).
    4. Otherwise, no recommendation.
    """
    eligible_by_id = {
        profile.id: profile
        for profile in profiles
        if not _refuses_to_start(profile, inspection.context_length)
    }

    for profile_id in profile_ids_for_same_model_type:
        reused_profile = eligible_by_id.get(profile_id)
        if reused_profile is not None:
            return ServingProfileRecommendation(
                profile=reused_profile,
                reason=(
                    "already the default serving profile for another registered "
                    f"{inspection.model_type!r} checkpoint"
                ),
            )

    if inspection.model_type is not None:
        for profile in eligible_by_id.values():
            if profile.label is None:
                continue
            if profile.reasoning_parser == inspection.model_type:
                return ServingProfileRecommendation(
                    profile=profile,
                    reason=(
                        f"labelled profile {profile.label!r} carries "
                        f"--reasoning-parser {profile.reasoning_parser!r}, matching "
                        f"model_type {inspection.model_type!r}"
                    ),
                )

    if profiles and not eligible_by_id:
        return ServingProfileRecommendation(
            profile=None,
            reason=(
                "every existing serving profile's max_model_len exceeds this "
                f"checkpoint's context_length ({inspection.context_length})"
            ),
        )

    return ServingProfileRecommendation(
        profile=None,
        reason=(
            "no serving profile is reused by a checkpoint of the same model_type, "
            "or labelled with a matching reasoning parser"
        ),
    )


def _refuses_to_start(profile: ServingProfileSummary, context_length: int | None) -> bool:
    """True only when both values are known and vLLM would actually
    refuse to start -- `max_model_len` exceeding what the checkpoint's
    weights support. An unread `context_length` (R-D20) is not grounds
    to treat every profile as incompatible just because it is unknown.
    """
    if profile.max_model_len is None or context_length is None:
        return False
    return profile.max_model_len > context_length


def recommend_sampling_profile(
    inspection: CheckpointInspection,
    profiles: list[SamplingProfileSummary],
    profile_ids_for_same_model_type: list[int],
) -> SamplingProfileRecommendation:
    """Recommends one of `profiles` for a freshly-inspected checkpoint.
    `reason` is never empty -- a recommendation the user cannot see the
    basis for is one they will ignore.

    Order:
    1. Prefer a profile already used as the default for a registered
       checkpoint of the same `model_type`: a derived checkpoint
       normally reuses its base's sampling profile too.
    2. Otherwise, the profile labelled `greedy` -- S-D11's backfill
       target, and the one sampling profile every checkpoint can safely
       start from when nothing else is known about it.

    Unlike `recommend_serving_profile`, there is no eligibility filter
    here: no sampling value can make vLLM refuse to start the way an
    oversized `max_model_len` can, so every profile is always a
    candidate.
    """
    profiles_by_id = {profile.id: profile for profile in profiles}

    for profile_id in profile_ids_for_same_model_type:
        reused_profile = profiles_by_id.get(profile_id)
        if reused_profile is not None:
            return SamplingProfileRecommendation(
                profile=reused_profile,
                reason=(
                    "already the default sampling profile for another registered "
                    f"{inspection.model_type!r} checkpoint"
                ),
            )

    for profile in profiles:
        if profile.label == "greedy":
            return SamplingProfileRecommendation(
                profile=profile,
                reason="the catalog default for a checkpoint nothing else is known about",
            )

    return SamplingProfileRecommendation(
        profile=None,
        reason=(
            "no sampling profile is reused by a checkpoint of the same model_type, and "
            "no profile labelled 'greedy' exists"
        ),
    )
