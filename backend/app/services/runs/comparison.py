"""`comparison_hash` -- what the leaderboard groups runs by
(docs/STANDARDS_AND_PROFILES_PHASES.md Section 0.5, S-D5).

Two runs belong on the same leaderboard row only if they were produced
the same way: same standard, same resolved sampling profile. Serving
profile is deliberately not part of this (S-D5) -- our one serving
profile doesn't quantize at serve time, so checkpoint identity already
covers the weights, and folding it in here would split the leaderboard
population over a value that cannot move a score.
"""

from app.services.content_hash import content_hash


def comparison_hash(standard_hash: str, sampling_hash: str) -> str:
    """Computed at submit time and stored on `eval_run`, not derived at
    read time (S-D23): a mismatch between the stored hash and the rows
    it names must surface as a hash mismatch, not a wrong number wearing
    the right label.
    """
    return content_hash({"standard": standard_hash, "sampling": sampling_hash})
