"""The rule-to-English table for Layer 5's checklist
(docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 7): every IFEval and
IFBench rule id, condensed into a short phrase a reader can act on
without knowing what `change_case:capital_word_frequency` means.

All 83 phrases (IFEval's 25, IFBench's 58) were written against the
exact upstream `build_description()` output for every rule id, pulled
from `registry.local/evalscope:2ce95c3-tier1` with real `kwargs` from
`runs/run-13` and `runs/run-12` -- not guessed from the rule id alone.
This module has no dependency on `evalscope` itself: the backend
process never imports it (that stays confined to the harness image,
per `recheck_instructions.py`'s own docstring), so the phrases are
written here as plain data instead of called through the checkers.

One deliberate correction against upstream: `keywords:letter_frequency`
substitutes a *randomly chosen* letter into its own description when
`letter` falls outside a-z (the checker quirk
docs/SCORE_DRILLDOWN_UI_PLAN.md Section 6 documents, and decision 4
says not to build a quirk tag for). This module reads `letter` from
`kwargs` directly, so a sample asking for `#` reads as `#`, not
upstream's own randomly-substituted letter -- more truthful, not less.
"""

from collections.abc import Callable
from typing import Any

# "less than"/"at least" are the only two relation values seen across
# every rule in both catalogued benchmarks' real kwargs; "more than"
# and "equal to" are included defensively since nothing about the
# checker's own contract rules them out. An unrecognized relation
# value passes through unchanged rather than raising -- a template
# should degrade to slightly awkward English, never to a raw-id
# fallback over one unmapped word.
_RELATION_PHRASES: dict[str, str] = {
    "less than": "fewer than",
    "at least": "at least",
    "more than": "more than",
    "equal to": "exactly",
}


def _relation_phrase(value: str) -> str:
    return _RELATION_PHRASES.get(value, value)


def _clean_value(key: str, value: Any) -> str:
    """One kwarg value, ready to drop into a template's `{}`.

    Every IFBench count-style kwarg (`N`, `small_n`, `percentage`, the
    word-count bounds) arrives as a whole-number float from the
    reviews file's own JSON -- confirmed against real kwargs from
    `runs/run-12` -- so `3.0` renders as `3`, not `3.0`. IFEval's
    equivalents are already ints and pass through untouched.
    """
    if isinstance(value, list):
        # keywords:existence / keywords:forbidden_words -- the only
        # list-valued kwargs in either benchmark's real data.
        return ", ".join(str(item) for item in value)
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if "relation" in key and isinstance(value, str):
        return _relation_phrase(value)
    return str(value)


def _clean_kwargs(kwargs: dict[str, Any]) -> dict[str, str]:
    return {key: _clean_value(key, value) for key, value in kwargs.items()}


def _capital_word_frequency(kwargs: dict[str, Any]) -> str:
    """The one rule with an acceptance value that names an exact
    phrase (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 7: sample
    1040's failing rule must read "at least 1 ALL-CAPS word", singular)
    -- a plain `.format()` template can't pluralize, so this rule gets
    a real function instead.
    """
    relation = _relation_phrase(str(kwargs["capital_relation"]))
    count = kwargs["capital_frequency"]
    noun = "word" if count == 1 else "words"
    return f"{relation} {count} ALL-CAPS {noun}"


# Rules whose phrase needs real logic (pluralization, today) rather
# than substitution into a fixed template.
_SPECIAL_TEMPLATES: dict[str, Callable[[dict[str, Any]], str]] = {
    "change_case:capital_word_frequency": _capital_word_frequency,
}

# IFEval's 25 rule ids. Every phrase was checked against a real
# `build_description()` call with the kwargs shown alongside it in
# this module's own docstring header -- not guessed from the id.
_IFEVAL_TEMPLATES: dict[str, str] = {
    "change_case:english_capital": "entire response in ALL CAPS",
    "change_case:english_lowercase": "entire response in lowercase, no capital letters",
    "combination:repeat_prompt": "repeat the prompt exactly, then answer it",
    "combination:two_responses": "give two responses separated by ******",
    "detectable_content:number_placeholders": (
        "at least {num_placeholders} bracketed placeholders, e.g. [address]"
    ),
    "detectable_content:postscript": "a postscript starting with '{postscript_marker}'",
    "detectable_format:constrained_response": (
        "answer with exactly one of: 'My answer is yes.', 'My answer is no.', 'My answer is maybe.'"
    ),
    "detectable_format:json_format": "entire output wrapped in JSON",
    "detectable_format:multiple_sections": (
        "{num_sections} sections, each marked '{section_spliter} N'"
    ),
    "detectable_format:number_bullet_lists": "exactly {num_bullets} markdown bullet points",
    "detectable_format:number_highlighted_sections": (
        "at least {num_highlights} markdown-highlighted sections"
    ),
    "detectable_format:title": "a title wrapped in <<double angle brackets>>",
    "keywords:existence": "must include: {keywords}",
    "keywords:forbidden_words": "must not include: {forbidden_words}",
    "keywords:frequency": "the word '{keyword}' must appear {relation} {frequency} times",
    "keywords:letter_frequency": (
        "the letter '{letter}' must appear {let_relation} {let_frequency} times"
    ),
    "language:response_language": "entire response in language '{language}'",
    "length_constraints:nth_paragraph_first_word": (
        "{num_paragraphs} paragraphs, paragraph {nth_paragraph} starts with '{first_word}'"
    ),
    "length_constraints:number_paragraphs": "exactly {num_paragraphs} paragraphs, separated by ***",
    "length_constraints:number_sentences": "{relation} {num_sentences} sentences",
    "length_constraints:number_words": "{relation} {num_words} words",
    "punctuation:no_comma": "no commas anywhere in the response",
    "startend:end_checker": "must end with exactly: '{end_phrase}'",
    "startend:quotation": "wrapped in double quotes",
}

# IFBench's 58 rule ids, same discipline. Grouped by family prefix
# purely for a reader scanning this table -- no behavioral meaning.
_IFBENCH_TEMPLATES: dict[str, str] = {
    # count:* -- 9 rules
    "count:conjunctions": "at least {small_n} different coordinating conjunctions",
    "count:keywords_multiple": (
        "'{keyword1}' once, '{keyword2}' twice, '{keyword3}' three times, "
        "'{keyword4}' five times, and '{keyword5}' seven times"
    ),
    "count:numbers": "exactly {N} numbers in the response",
    "count:person_names": "at least {N} different person names from a fixed list",
    "count:pronouns": "at least {N} pronouns",
    "count:punctuation": "every standard punctuation mark at least once",
    "count:unique_word_count": "at least {N} unique words",
    "count:word_count_range": "between {min_words} and {max_words} words",
    "count:words_japanese": "every {N}th word must be in Japanese",
    # custom:* -- 11 one-off, whole-task rules; no kwargs to
    # substitute for any of them.
    "custom:character_reverse": "answer written in reverse, letter by letter",
    "custom:csv_city": "output as comma-separated CSV with the requested columns and row count",
    "custom:csv_quotes": "output as CSV with each field double-quoted",
    "custom:csv_special_character": (
        "output as CSV including one field with a special character, double-quoted"
    ),
    "custom:date_format_list": "dates listed as YYYY-MM-DD, comma-separated, no explanation",
    "custom:european_capitals_sort": "answer sorted by latitude, comma-separated, no country names",
    "custom:mcq_count_length": (
        "multiple-choice questions labeled 'Question', each longer than the last"
    ),
    "custom:multiples": "count within a range, printing only the requested multiples",
    "custom:reverse_newline": "list items in reverse order, one per line",
    "custom:sentence_alphabet": "each sentence's first word follows the alphabet in order",
    "custom:word_reverse": "answer written in reverse, word by word",
    # format:* -- 14 rules
    "format:emoji": "an emoji at the end of every sentence",
    "format:line_indent": "each new line indented one step further than the last",
    "format:list": "a list using '{sep}' instead of bullet points",
    "format:newline": "one word per line",
    "format:no_bullets_bullets": "at least two sentences, then at least two bullet points",
    "format:no_whitespace": "no whitespace anywhere in the output",
    "format:options": "answer with one of: {options}",
    "format:output_template": (
        "must follow the exact template: 'My Answer: [answer] My Conclusion: [conclusion] "
        "Future Outlook: [outlook]'"
    ),
    "format:parentheses": "parentheses nested at least 5 levels deep",
    "format:quote_unquote": "every quoted phrase followed by an unquoted explanation",
    "format:quotes": "quotes nested at least 3 levels, alternating double and single",
    "format:sub-bullets": "each bullet point has at least one sub-bullet",
    "format:thesis": "each section opens with an italic thesis statement",
    "format:title_case": "entire response in Title Case",
    # ratio:* -- 5 rules
    "ratio:overlap": "at least {percentage}% trigram overlap with the reference text",
    "ratio:sentence_balance": "declarative, interrogative, and exclamatory sentences kept balanced",
    "ratio:sentence_type": "a 2:1 ratio of declarative to interrogative sentences",
    "ratio:sentence_words": "three sentences of equal length, no repeated words",
    "ratio:stop_words": "stop words at most {percentage}% of the response",
    # repeat:* -- 3 rules. `prompt_to_repeat` is the full prompt text
    # (often 100+ characters) and is deliberately left out of the
    # phrase -- these three describe the *transformation*, not the
    # text being transformed.
    "repeat:repeat_change": "repeat the request with its first word changed, then do not answer it",
    "repeat:repeat_simple": "output only the fixed sentence, ignore the rest of the prompt",
    "repeat:repeat_span": "repeat the prompt's characters {n_start} through {n_end} exactly",
    # sentence:* -- 3 rules
    "sentence:alliteration_increment": "each sentence's alliterative run longer than the last",
    "sentence:increment": "each sentence exactly {small_n} words longer than the previous",
    "sentence:keyword": "keyword '{word}' must appear in sentence {N}",
    # words:* -- 13 rules
    "words:alphabet": "each word starts with the next letter of the alphabet, wrapping after Z",
    "words:consonants": "every word contains a consonant cluster",
    "words:keywords_specific_position": "'{keyword}' as word {m} of sentence {n}",
    "words:last_first": "each sentence's first word is the previous sentence's last word",
    "words:no_consecutive": "no two consecutive words share a first letter",
    "words:odd_even_syllables": "alternate odd- and even-syllable words",
    "words:palindrome": "at least 10 single-word palindromes, 5+ characters each",
    "words:paragraph_last_first": "each paragraph ends with the word it started with",
    "words:prime_lengths": "every word's length is a prime number",
    "words:repeats": "no word repeated more than {small_n} times",
    "words:start_verb": "response starts with a verb",
    "words:vowel": "every word uses only three vowel types",
    "words:words_position": "word 2 and the second-to-last word are both '{keyword}'",
}

_TEMPLATES: dict[str, str] = {**_IFEVAL_TEMPLATES, **_IFBENCH_TEMPLATES}


def describe_rule(rule_id: str, kwargs: dict[str, Any] | None) -> str:
    """The short phrase for one rule id, or `rule_id` itself when the
    id is unrecognized or its kwargs don't match what the template
    expects. A description must never be the reason a sample page
    fails to render -- Phase 7's own "cover every rule id present in
    a real reviews file and fall back to the raw id for anything
    unrecognized."
    """
    kwargs = kwargs or {}

    special = _SPECIAL_TEMPLATES.get(rule_id)
    if special is not None:
        try:
            return special(kwargs)
        except (KeyError, TypeError, ValueError):
            return rule_id

    template = _TEMPLATES.get(rule_id)
    if template is None:
        return rule_id
    try:
        return template.format(**_clean_kwargs(kwargs))
    except (KeyError, IndexError, ValueError):
        return rule_id
