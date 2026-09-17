"""The deterministic written summary (docs/SCORE_DRILLDOWN_UI_PLAN.md
Section 6; docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 8): a
handful of template sentences driven by thresholds over counts that
are also on screen elsewhere in the diagnostics file -- never an LLM
call, because "a wrong summary about wrongness is worse than no
summary" and a summary that paraphrases differently on every load
cannot go in a report.

Every sentence is built from integers only, never a formatted
percentage or float -- what makes two rebuilds of the same run produce
byte-identical text a property of the arithmetic, not a convention to
remember.
"""

from app.services.diagnostics.records import Bucket, DiagnosticsSummary, TagCount

# The finest bucket level's own row noun, for the "weakest X" sentence
# -- data, not per-benchmark branching, the same approach
# FailureBreakdown.helper.ts's LEVEL_LABELS uses on the frontend. An
# unrecognized level (a future benchmark's own grouping) falls back to
# the raw level string rather than a lookup failure.
_LEVEL_NOUNS: dict[str, str] = {
    "rule": "rule",
    "family": "rule family",
    "subject": "subject",
}

# Below this many lost instructions, a "weakest X" sentence would be
# calling out noise rather than a real weak point. The actual
# worst-rule finding this whole plan is built around
# (length_constraints:nth_paragraph_first_word, 12 lost) clears this by
# a wide margin.
_WORST_BUCKET_MIN_LOST = 3


def build_narrative(
    summary: DiagnosticsSummary, buckets: list[Bucket], tag_counts: list[TagCount]
) -> list[str]:
    """One short paragraph's worth of sentences, in a fixed order,
    each emitted only when its own threshold is met -- "a clean run
    should produce a short summary, not a paragraph of zeros" (Phase
    8). A run with zero failures gets exactly one sentence and nothing
    else: there is nothing to explain about a clean run.
    """
    if summary.failed == 0:
        return [f"All {summary.n_samples} samples passed."]

    tag_totals = {tag_count.tag: tag_count.n_samples for tag_count in tag_counts}
    sentences = [f"{summary.failed} of {summary.n_samples} samples failed."]

    severity_sentence = _severity_sentence(summary.failed, tag_totals)
    if severity_sentence is not None:
        sentences.append(severity_sentence)

    worst_bucket_sentence = _worst_bucket_sentence(buckets)
    if worst_bucket_sentence is not None:
        sentences.append(worst_bucket_sentence)

    sentences.extend(_cause_sentences(tag_totals))
    return sentences


def _severity_sentence(failed: int, tag_totals: dict[str, int]) -> str | None:
    near_miss = tag_totals.get("near_miss", 0)
    complete_miss = tag_totals.get("complete_miss", 0)
    if near_miss == 0 and complete_miss == 0:
        return None
    if near_miss > complete_miss:
        return (
            f"{near_miss} of the {failed} failures are near misses \u2014 the model followed "
            "some of the question's rules and broke the rest."
        )
    if complete_miss > near_miss:
        return (
            f"{complete_miss} of the {failed} failures are complete misses \u2014 every rule "
            "on the question was broken."
        )
    return (
        f"The failures split evenly: {near_miss} near misses and {complete_miss} complete misses."
    )


def _worst_bucket_sentence(buckets: list[Bucket]) -> str | None:
    """Reads the finest level's own top row -- `buckets.sort_buckets`
    already ranked every level by instructions lost, and IFEval's
    `build_buckets` always appends the finer `rule` level after the
    coarser `family` one, so the last-added level (`buckets[-1].level`)
    is always the finest one present. `[]` (GSM8K, GPQA-Diamond) and an
    unknown-outcome top row (a failed recheck) both produce no
    sentence rather than a guess.
    """
    if not buckets:
        return None
    finest_level = buckets[-1].level
    finest_rows = [bucket for bucket in buckets if bucket.level == finest_level]
    worst = finest_rows[0]
    if worst.passed is None:
        return None
    lost = worst.n_instructions - worst.passed
    if lost < _WORST_BUCKET_MIN_LOST:
        return None
    noun = _LEVEL_NOUNS.get(finest_level, finest_level)
    if worst.passed == 0:
        return f"One {noun}, {worst.name}, never passed once \u2014 0 of {worst.n_instructions}."
    return f"The weakest {noun} is {worst.name} \u2014 {worst.passed} of {worst.n_instructions}."


def _cause_sentences(tag_totals: dict[str, int]) -> list[str]:
    """Cosmetic, then truncated, then empty, then wrong_language, then
    recheck_disagrees -- a fixed order, each only when its own count
    is non-zero, per Phase 8's own ordering.
    """
    sentences: list[str] = []

    cosmetic = tag_totals.get("cosmetic", 0)
    if cosmetic:
        sentences.append(
            f"{cosmetic} failures are cosmetic \u2014 they pass the forgiving checker and "
            "fail the strict one, so the content was right and the wrapper was wrong."
        )

    truncated = tag_totals.get("truncated", 0)
    if truncated:
        sentences.append(
            f"{truncated} failing answers were cut off at the token limit \u2014 a mechanical "
            "failure, not a model one."
        )

    empty = tag_totals.get("empty", 0)
    if empty:
        sentences.append(
            f"{empty} failing answers came back empty \u2014 usually a request error rather "
            "than a model failure."
        )

    wrong_language = tag_totals.get("wrong_language", 0)
    if wrong_language:
        sentences.append(f"{wrong_language} failures answered in the wrong language.")

    recheck_disagrees = tag_totals.get("recheck_disagrees", 0)
    if recheck_disagrees:
        sentences.append(
            f"{recheck_disagrees} failures could not be attributed to a rule \u2014 the "
            "recheck found every rule passing on a sample the harness scored as failed. The "
            "harness score stays authoritative."
        )

    return sentences
