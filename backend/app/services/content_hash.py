"""The canonical-JSON content hash shared by every content-addressed
table (`recipe`, `serving_profile`): canonical JSON (sorted keys, no
whitespace, UTF-8, floats rounded to 6 decimal places), SHA-256, first
16 hex characters.

A hash whose definition drifts is worse than no hash -- it looks
authoritative while silently splitting or merging populations that
should have compared equal. `recipe_hash()`
(app/services/recipes/hashing.py) and `serving_profile_hash()`
(app/services/serving_profiles/hashing.py) both delegate to
`content_hash()` below rather than each defining their own, so the two
can never drift apart from each other. Getting a stable, reproducible
hash is the entire point, so nothing here is negotiable without also
handling every already-hashed row that used the old definition.
"""

import hashlib
import json
from typing import Any


def _round_floats(value: Any) -> Any:
    """Round every float in a (possibly nested) structure to 6 decimals.

    `0.1 + 0.2` serialises differently from `0.3` -- without this step,
    two otherwise-identical configs would silently get different hashes.
    """
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, dict):
        return {key: _round_floats(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_round_floats(item) for item in value]
    return value


def content_hash(config: dict[str, Any]) -> str:
    """Hash a content-addressed row's hashable dict (see
    `Recipe.as_hashable_dict` / `ServingProfile.as_hashable_dict`).

    Two dicts that are equal after float-rounding always produce the
    same hash, regardless of key insertion order, because `sort_keys`
    makes the JSON serialisation canonical.
    """
    rounded = _round_floats(config)
    canonical_json = json.dumps(rounded, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()[:16]
