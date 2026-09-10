"""The standard hash, exactly as specified in
docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5: canonical JSON
(sorted keys, no whitespace, UTF-8, floats rounded to 6 decimal places),
SHA-256, first 16 hex characters.

The algorithm itself lives in `app.services.content_hash`, shared with
`serving_profile_hash` and `sampling_profile_hash` so the three
definitions -- meant to be identical -- cannot drift apart. This module
stays as the name every standard call site imports.
"""

from typing import Any

from app.services.content_hash import content_hash


def standard_hash(config: dict[str, Any]) -> str:
    """Hash a standard's hashable dict (see `Standard.as_hashable_dict`).

    Two dicts that are equal after float-rounding always produce the
    same hash, regardless of key insertion order -- see
    `app.services.content_hash.content_hash` for exactly how.
    """
    return content_hash(config)
