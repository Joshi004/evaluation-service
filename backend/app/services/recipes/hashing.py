"""The recipe hash, exactly as specified in docs/IMPLEMENTATION_PHASES.md
Section 0.6: canonical JSON (sorted keys, no whitespace, UTF-8, floats
rounded to 6 decimal places), SHA-256, first 16 hex characters.

The algorithm itself lives in `app.services.content_hash`, shared with
`serving_profile_hash` (docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 3)
so the two definitions -- meant to be identical -- cannot drift apart.
This module stays as the name every recipe call site imports.
"""

from typing import Any

from app.services.content_hash import content_hash


def recipe_hash(config: dict[str, Any]) -> str:
    """Hash a recipe's hashable dict (see `Recipe.as_hashable_dict`).

    Two dicts that are equal after float-rounding always produce the
    same hash, regardless of key insertion order -- see
    `app.services.content_hash.content_hash` for exactly how.
    """
    return content_hash(config)
