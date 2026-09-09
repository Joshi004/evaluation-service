"""The serving-profile hash. Reuses the canonical-JSON algorithm in
`app.services.content_hash` -- the same one `recipe_hash`
(app/services/recipes/hashing.py) delegates to -- rather than a second,
separately maintained definition: two hash definitions that are meant to
be identical and aren't kept in one place will drift, and a drifted
hash looks authoritative while silently splitting populations that
should have compared equal.
"""

from typing import Any

from app.services.content_hash import content_hash


def serving_profile_hash(config: dict[str, Any]) -> str:
    """Hash a serving profile's hashable dict (see
    `ServingProfile.as_hashable_dict`).

    `gpu_memory_utilization` is a float, so this rounds through
    `content_hash`'s 6-dp rule same as every other float -- `0.85` hashes
    identically no matter how it arrived (R-T11).
    """
    return content_hash(config)
