"""The sampling-profile hash. Reuses the canonical-JSON algorithm in
`app.services.content_hash` -- the same one `serving_profile_hash`
(app/services/serving_profiles/hashing.py) delegates to -- rather than a
second, separately maintained definition: two hash definitions that are
meant to be identical and aren't kept in one place will drift, and a
drifted hash looks authoritative while silently splitting populations
that should have compared equal.
"""

from typing import Any

from app.services.content_hash import content_hash


def sampling_profile_hash(config: dict[str, Any]) -> str:
    """Hash a sampling profile's hashable dict (see
    `SamplingProfile.as_hashable_dict`).

    Every float field rounds through `content_hash`'s 6-dp rule same as
    every other content-addressed table -- `0.6` hashes identically no
    matter how it arrived.
    """
    return content_hash(config)
