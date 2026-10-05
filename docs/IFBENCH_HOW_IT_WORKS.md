# How IFBench works in this service

IFBench tests whether a model can follow precise, mechanical rules about the shape of its reply, such as "include exactly 3 numbers" or "answer with one of: yes/no/maybe". It was made by Ai2 (the Allen Institute for AI) and the University of Washington as a harder follow-up to IFEval, because models score well on IFEval's 25 rule types but much worse on rules they have not seen before. IFBench has 300 questions and 58 new rule types. Every rule is checked by plain Python code, not by another model.

This service runs IFBench through EvalScope the same way it runs IFEval: same four numbers, same headline (`prompt_level_strict`), no worked examples, and the model gets the raw question as is. This page covers only what is specific to IFBench. For the path a run takes from the Submit button to the leaderboard, read the [IFEval doc](IFEVAL_HOW_IT_WORKS.md#step-by-step-how-a-request-actually-travels). It is the same path.

Three things to know before you read on:

- **The strict score is literal.** In the two saved runs, the model wrote out its thinking first ("thinking mode"), and every reply then starts with a blank line. The strict checks do not remove it. That alone costs 13 to 14 of 300 questions, about 4 to 5 points.
- **300 questions is a small test.** One run's score has a 95% range of about ±5.6 points. Between run 12 and run 16, 47 of the 300 questions came out differently.
- **The checkers in the image are a snapshot from August 2026.** The IFBench authors and EvalScope have fixed several checker bugs since. On the two saved runs the fixes move the headline by at most 2 questions, but one affected question is a clear case of a correct reply marked wrong (example 4 below).

---

## What IFBench is testing

IFBench does not test knowledge, and it does not judge whether an answer is good. It checks one thing: **did the reply obey a rule that a program can verify.**

Each question is an ordinary request taken from real chat logs, with one or two rules added. A few of the 58 rules:

- include exactly N numbers in the reply (`count:numbers`)
- answer with one of the given options and nothing else (`format:options`)
- use no whitespace at all (`format:no_whitespace`)
- start each word with the next letter of the alphabet (`words:alphabet`)
- make each sentence exactly N words longer than the one before (`sentence:increment`)
- copy a stretch of the prompt exactly (`repeat:repeat_span`)
- write the answer backwards, word by word (`custom:word_reverse`)

A rule id has two parts: a family, then a name. The 300 questions carry 344 rules in total: 256 questions have one rule and 44 have two.

| Family | Rules checked | Rule types | What they are like |
|---|---|---|---|
| `format` | 98 | 14 | layout: options, bullet lists, nested quotes and brackets, indentation, no whitespace |
| `words` | 89 | 13 | patterns inside words: alphabet order, syllables, palindromes, prime lengths |
| `count` | 65 | 9 | exact or minimum counts: numbers, conjunctions, pronouns, person names |
| `ratio` | 44 | 5 | shares and proportions: stop-word percentage, sentence types, overlap with a text |
| `sentence` | 28 | 3 | sentence-by-sentence rules: a keyword in sentence N, growing length |
| `custom` | 11 | 11 | one-off tasks, one question each: CSV output, reverse the text, sort capitals by latitude |
| `repeat` | 9 | 3 | copy, or copy and change, part of the prompt (the paper calls this family "copy") |

**Who made it, and why.** Valentina Pyatkin and colleagues at Ai2 and the University of Washington. The paper is *Generalizing Verifiable Instruction Following* (arXiv 2507.02833, July 2025; accepted to NeurIPS 2025, Datasets and Benchmarks track). Their finding: models get tuned on the small set of rules in earlier tests such as IFEval, so they look good there and do much worse on new rules. In the paper's Table 2, Tülu-3 8B (DPO version) scores 81.1 on IFEval and 25.5 on IFBench. To measure this better, they wrote 58 new rules, attached them to prompts from WildChat (a public collection of real user chats) that had been held out from release, and had people check that each prompt and rule make sense together.

**What it does not test.**

- Whether the answer is any good. A reply that obeys the rule and ignores the request still passes (examples 1 and 2 below). The paper measured this cost: on prompts with the rules removed, a model trained to satisfy rules got 6.4 out of 10 from a judge model, against 7.0 for the model it started from.
- Knowledge or reasoning, beyond what is needed to count or format.
- Rules that code cannot check. The authors say so: their rules "might sometimes seem unnatural or contrived".
- Multi-turn conversations. The authors also published a multi-turn set; this service does not use it.

---

## At a glance

| | |
|---|---|
| Recipe | `catalog/standards/ifbench-v1.yaml` (label `ifbench/v1`) |
| Dataset | `allenai/IFBench_test`, split `train` (its only split) |
| Questions | 300, with 344 rule checks and 58 rule types |
| Worked examples shown first | none (`few_shot: 0`) |
| Prompt wrapper | none: the model gets the raw `prompt` as one user message |
| What is graded | the visible reply, as one block of text (no answer extraction) |
| Graded by | Python rule checkers, no judge model |
| Headline number | `prompt_level_strict` |
| Other numbers kept | `inst_level_strict`, `prompt_level_loose`, `inst_level_loose` |
| Repeats per question | 1 |
| Requests at once | up to 32 (`eval_batch_size`); 1,800 s allowed per request |
| Harness image (the container that runs the test) | `registry.local/evalscope:2ce95c3-tier1` (EvalScope commit `2ce95c3`, 18 August 2026) |
| Reference score in the recipe | none; it says "NOT YET RUN" |

---

## Where the questions live

### The original home

The questions are on Hugging Face as [`allenai/IFBench_test`](https://huggingface.co/datasets/allenai/IFBench_test) (Ai2's account there is `allenai`). The checker code is on GitHub at [`allenai/IFBench`](https://github.com/allenai/IFBench). The same project also publishes a multi-turn test set and training prompts. This service uses neither.

The dataset has one split, called `train`, with 300 rows. As with IFEval, the name is misleading: it is the whole test set.

### The copy this service loads

EvalScope loads datasets from ModelScope by default, a hub similar to Hugging Face; the saved config of every run shows `dataset_hub: modelscope` and the service does not change it. ModelScope lists the same id, `allenai/IFBench_test`, under the `allenai` organisation (created 3 July 2025, content last updated 18 October 2025, Apache 2.0 licence). I could not open its web page and could not find out how it is kept in sync with Hugging Face. The 300 questions saved in run 16 match the current Hugging Face file (prompts, rule ids and settings).

### Two versions exist

The Hugging Face file changed after its first release. The version from early July 2025 (revision `84e8120d`) had 294 questions and 57 rules. On 17 October 2025 it became the current 300 questions and 58 rules (10 prompts are new and 4 old ones are gone). The paper (version 3, November 2025) says 300 prompts; the README says 58 rules. I could not find a note on why the file changed. Scores published before mid-October 2025 may come from the older, smaller file.

### What one row contains

| Field | What it is |
|---|---|
| `key` | the row number, stored as text |
| `prompt` | the full question, with the rule written in plain words. **This is all the model sees.** |
| `instruction_id_list` | the rule ids for this question, for example `["count:numbers"]` |
| `kwargs` | one block of settings per rule, for example `{"N": 3}`. Each block has 42 fields and all but the used ones are empty (`null`). The checker drops the empty ones before use |

The rule ids and settings are never shown to the model. They only tell the checker what to look for.

### Row order

The rows come in blocks, one block per rule: rows 0 to 4 all use `count:keywords_multiple`, rows 5 to 9 all use `count:conjunctions`, and so on. EvalScope does not shuffle them (`shuffle: false` in the saved config). A short test with `sample_limit` therefore takes the first N rows and sees only a few rules. `runs/run-1` is an example: its 20 questions cover 5 of the 58 rules and scored 5 of 20 (25%) for `Qwen3-4B-allternary-ep03`. That number says nothing about the full test. (The config and log files in that folder belong to a later IFEval run of another model; only the three `ifbench` files describe the 20-question run.)

### How the questions get into the container

They are baked into the image when it is built. `harness/evalscope/prefetch_dataset.py` loads the data for all five supported benchmarks once, through EvalScope's own loader, into `/opt/hf-cache/modelscope` (set in the `Dockerfile`). At run time the data loads from disk: in run 16's log, "Start loading benchmark dataset" and "300 samples to evaluate" are in the same second, and there are no download lines. The recipe does not pin a dataset version (`dataset_revision: null`); the image tag is the real pin. To pick up a changed dataset, rebuild the image.

### Where results are stored

Each run writes a folder, `runs/run-<id>/`. The IFBench files are:

```
reports/<model>/ifbench.json                      the four numbers, from EvalScope
predictions/<model>/ifbench_default.jsonl         every question, the full reply (thinking and answer), token counts
reviews/<model>/ifbench_default.jsonl             the same, plus the four scores per question
diagnostics/<model>/ifbench.json                  the service's own digest: tags, failures by rule family and rule
diagnostics/<model>/ifbench.rule_results.jsonl    strict and loose result for each rule on each question
configs/task_config.yaml, harness_task_config.json, logs/eval_log.log
```

The backend also copies the whole report into the database and keeps the four numbers (plus the truncation rate) as rows, as described in the [IFEval doc](IFEVAL_HOW_IT_WORKS.md#step-by-step-how-a-request-actually-travels).

---

## What a question looks like

The model never sees `instruction_id_list` or `kwargs`. It sees only `prompt`, with the rules written in plain words. Below are four real questions with replies from the saved runs. Replies are shown as saved: `\n` marks a line break. I shortened nothing in the questions or replies unless a "..." says so.

### Example 1: a short question the model passes

**Dataset row** (`key` 20; only the filled-in settings are shown):

```json
{
  "key": "20",
  "prompt": "Include exactly 3 numbers in the response. Make this short: An alignment of resources and education goals within each community is needed to support the education ecosystem of students, teachers, and parents and assist in the adjustment to the new normal—homeschooling, parents-teachers training, community internet centers, a Citizen Watch for Education, and establishing LGU leaders as education champions.",
  "instruction_id_list": ["count:numbers"],
  "kwargs": [{"N": 3.0}]
}
```

**What the model receives.** One user message containing exactly the `prompt` text above. No system message, no worked examples, no template from the service. (The model server then applies the model's own chat template; I did not read that rendered text.)

**A real reply** (run 16 and run 12 gave the same text):

```
\n\n1 2 3
```

The model first wrote about 4,600 characters of thinking (run 16). Thinking is not graded.

**How it was graded.** The rule `count:numbers` with `N = 3` removes punctuation, finds every run of digits and requires exactly 3. `1 2 3` has 3, so it passes strict and loose. The reply did not shorten the text at all; the checker cannot see that.

### Example 2: two rules, one passes

**Dataset row:**

```json
{
  "key": "22",
  "prompt": "Include exactly 15 numbers in the response. Use at least 5 different coordinating conjunctions in the response. what is the meaning of life?",
  "instruction_id_list": ["count:numbers", "count:conjunctions"],
  "kwargs": [{"N": 15.0}, {"small_n": 5.0}]
}
```

**What the model receives:** the `prompt` text above, as one user message.

**A real reply** (run 16; run 12 wrote the same in capitals):

```
\n\n1 2 3 4 5 6 7 8 9 10 11 12 13 14 15\nand or but for since
```

**How it was graded.** `count:numbers` finds 15 numbers: pass. `count:conjunctions` counts distinct words from a fixed list (and, but, for, nor, or, so, yet). The reply has `and`, `or`, `but` and `for`: four. `since` is not on the list, so the rule needs five and fails. Result for this question: prompt-level 0 (not every rule passed), instruction-level 0.5 (one of two rules passed), in both strict and loose. The question "what is the meaning of life?" is never answered, and nothing checks that.

### Example 3: a format problem, not a wrong answer

**Dataset row:**

```json
{
  "key": "100",
  "prompt": "Answer with one of the following options: yes/no/maybe. Could sensitive historical events be better digested in game form with humour, interesting allegorical story, and loveable characters?",
  "instruction_id_list": ["format:options"],
  "kwargs": [{"options": "yes/no/maybe"}]
}
```

**What the model receives:** the `prompt` text above, as one user message.

**A real reply** (run 16; run 12 answered `\n\nyes`):

```
\n\nmaybe
```

**How it was graded.** The reply is one of the allowed words, so a person would say it is right. The strict checker removes punctuation and spaces from both ends of the reply, lowercases it, and compares it with the options. A line break is neither punctuation nor a space, so `\n\nmaybe` does not equal `maybe`: **strict fails**. Loose also tries the reply without its first line, which is `maybe`: **loose passes**. This is the main reason the loose headline is higher than the strict one in the saved runs. More on this under "Things worth knowing".

### Example 4: a correct reply marked wrong

**Dataset row** (the long `kwargs` text is shortened with "..."):

```json
{
  "key": "286",
  "prompt": "The walls are solid but the stones are cracked and cold. The windows reflect the dead landscape before you with small plants growing on the walls. \\n\\nAdd a sentence to make this description of a house \\\"appealing\\\". It can be humurous or sarcastic. Copy the span of words that lies between (and including) index 0 and 7, the indices are word indices, split by whitespace!",
  "instruction_id_list": ["repeat:repeat_span"],
  "kwargs": [{"n_start": 0, "n_end": 7, "prompt_to_repeat": "The walls are solid but the stones are cracked and cold. ... It can be humurous or sarcastic. "}]
}
```

**What the model receives:** the `prompt` text above. The `\n\n` and `\"` in it are literal backslash characters in the data, and the model gets them as they are.

**A real reply** (the same in run 16 and run 12):

```
\n\nThe walls are solid but the stones are
```

**How it was graded.** The prompt asks for words 0 to 7, which are exactly those eight words. The reply is right. But the checker in the image takes **characters** 0 to 7 of the text (`The wall`) and compares the reply with that. It fails in strict and loose, in both runs. All four `repeat:repeat_span` questions (rows 284 to 287) say "word indices", so a model that follows the prompt almost certainly fails all four. Newer checkers (EvalScope today, and Ai2's current code) count words; in my re-grade they pass this reply. The service's own rule description (`ifeval_descriptions.py`) says "characters", matching the checker, not the prompt.

---

## What the model has to produce

A normal chat reply that also obeys the rules. There is no special answer format: no `ANSWER:` line, no box. The whole visible reply is what gets checked.

- **What is looked at.** Only the visible reply. With thinking on, the model server separates the thinking from the answer, and the checkers never see the thinking. It stays in the `predictions` file for reading.
- **A blank line at the start.** In all 600 saved replies (300 in each of runs 12 and 16) the reply begins with two line breaks. This is what is left after the thinking block is cut off; I did not read the server code, but the pattern is the same in every saved reply. The strict check does not trim it.
- **Wrong format.** Any text is graded; there is no "wrong format" error. A reply that breaks a rule is a miss. Extras such as a code fence, "Here is the answer:", or a closing remark can break rules that look at the whole reply (no whitespace, only one of the options, CSV).
- **Empty reply.** Fails every rule, strict and loose.
- **Out of tokens.** A reply cut off by the limit is graded as it stands. If the model is still thinking when the limit hits, I expect the visible reply to be empty, which fails every rule. This never happened in the two saved runs: 0 truncated, 0 empty, and the longest output was about 7,000 tokens against a limit of 32,768. Qwen's model card warns that the 0.8B model is more prone to thinking loops in thinking mode, so another run could behave differently.
- **Thinking first.** The median thinking text is about 11,500 characters; the median visible reply is 156 characters (run 16) and 187 (run 12). Most of the output is thinking that nobody grades. Mean output was about 3,300 tokens per question (3,266 in run 16, 3,290 in run 12).

---

## How the grading works

EvalScope grades each question on its own. The general idea (strict, loose, prompt-level, instruction-level) is in the [IFEval doc](IFEVAL_HOW_IT_WORKS.md#how-an-answer-is-graded). These are the exact steps for IFBench, from reading the pinned EvalScope code.

### Step by step

1. EvalScope takes the visible reply text. Nothing is trimmed.
2. The question lists its rule ids and settings. EvalScope drops the empty (`null`) settings and builds one checker per rule.
3. **Strict:** a rule passes only if the reply is not blank and the checker says yes to the reply exactly as saved.
4. **Loose:** EvalScope makes eight versions of the reply: as it is; with all `*` removed; without its first line; without its last line; without both; and the last three again with `*` removed. A rule passes loose if any one of the eight passes.
5. **Per question:** the prompt-level value is 1 only if every rule on the question passed, otherwise 0. The instruction-level value is the share of that question's rules that passed (1, 0.5 or 0).
6. EvalScope averages each of the four values over all questions that received a score. These four numbers go into `reports/<model>/ifbench.json`.
7. The service reads the report. The headline is `prompt_level_strict`.

There is no judge model and no partial credit inside a rule.

### The four numbers, for the two saved runs

| Number | Run 12 (`merged_global_step_810`) | Run 16 (`Qwen3.5-0.8B-Think-MOPD-mixv2-RL-v11c-s810`) |
|---|---|---|
| `prompt_level_strict` (headline) | 44.7% (134 of 300) | 47.0% (141 of 300) |
| `prompt_level_loose` | 51.7% (155) | 53.3% (160) |
| `inst_level_strict` | 49.0% | 51.7% |
| `inst_level_loose` | 56.0% | 58.0% |

One detail about the instruction-level numbers: at the pinned EvalScope commit they are the average of each question's share (a 2-rule question counts the same as a 1-rule question). Ai2's own evaluation script pools all 344 rules instead, and EvalScope switched to pooling in a later fix (pull request #1672, 30 August 2026). For run 12, pooled strict is 48.5% (167 of 344) against the reported 49.0%. The prompt-level numbers are not affected. The service's diagnostics file keeps both versions.

### If a checker crashes

At the pinned commit, a checker that raises an error makes the adapter log the error and store an empty score for that question. The question is then left out of all four averages, and the count `num` in the report drops below 300. Both saved runs have `num` = 300, so nothing was dropped. The risk is real, though. EvalScope later fixed one such crash (the stop-word rule on a reply with no words, #1761, 29 September 2026). And when I re-graded run 16 with the blank line trimmed, the `ratio:overlap` checker divided by zero on question 213, a three-line reply whose middle line is two characters long. In the real run the leading blank line happened to hide this. Check `num` on every IFBench report.

### Extra libraries and data downloads

The checkers need more than a bare EvalScope install:

| What | Used by | Why it matters |
|---|---|---|
| `emoji` (pip) | `format:emoji` | the adapter refuses to load unless all three pip packages are installed, although each of `emoji` and `syllapy` serves one rule |
| `syllapy` (pip) | `words:odd_even_syllables` | same |
| `nltk` (pip) | about 19 of the 58 rules | splits text into sentences and words |
| NLTK `punkt_tab` | 10 rules call it directly; the helper code checks it as soon as it is loaded | splits text into sentences |
| NLTK `stopwords` | `ratio:stop_words` | the list of common words to ignore |
| NLTK `averaged_perceptron_tagger_eng` | `words:start_verb` | guesses whether the first word is a verb |

If NLTK data is missing, EvalScope tries to download it from the internet (mirrors on ModelScope's storage, Gitee and GitHub). For the container this means two things. The `Dockerfile` installs EvalScope with the `ifbench` extra (which brings the three pip packages) and runs `harness/evalscope/bake_nltk.py` at build time, so the NLTK data sits in `/opt/nltk_data` and a run needs no internet. And the re-check described below runs with networking switched off, so the baked data has to be complete. The three pip packages are not pinned in this repo, so a rebuild may pick up newer versions; I could not inspect the built image.

### What the service adds on top

- **A 95% range** on the headline: the span the true pass rate probably lies in, worked out with the Wilson method, a standard way to do this for pass rates (`report_summary.py`). For run 16 it is about 41% to 53%.
- **A re-check by rule.** After the run, a short-lived container from the same image runs the same checkers again on the saved replies, one rule at a time (`recheck_instructions.py`), and the result is saved as `ifbench.rule_results.jsonl`. For runs 12 and 16 it reproduces the stored scores.
- **Tags** on failing questions: `complete_miss` (no rule passed strict), `near_miss` (some rules passed), `cosmetic` (fails strict but passes loose), `recheck_disagrees` (the re-check finds every rule passing). There is no tag for "the checker is probably wrong".
- **A per-rule table** in the sample view (`IfevalRuleChecklist`), labelled as recomputed detail. The stored score stays the official one.

---

## How a run goes here

The path is the same as IFEval's. Only the IFBench-specific parts follow.

| Setting | Value | Set by |
|---|---|---|
| Worked examples, prompt wrapper, answer extraction | none | the recipe |
| Requests at once | 32 | the recipe (`eval_batch_size`) |
| Time allowed per request | 1,800 s | the recipe (`request_timeout_seconds`) |
| Repeats, question limit, subsets | 1 repeat, no limit (all 300), one subset called `default` | the recipe |
| Sampling (temperature and so on) | whatever the chosen sampling profile says; the recipe forces nothing (`sampling_overrides: {}`) | the sampling profile |
| Thinking on or off | the profile's `enable_thinking` | the sampling profile |
| Splitting thinking from the answer | needs a reasoning parser on the serving profile | the serving profile |

- **Batch size.** Each question is its own request, with up to 32 in flight. See [Batch or one-by-one?](IFEVAL_HOW_IT_WORKS.md#batch-or-one-by-one). In run 16, 300 questions took 4 minutes 33 seconds, about 27 seconds per request on average and 58 seconds for the slowest.
- **Thinking.** The service sends `enable_thinking` to the model server as `chat_template_kwargs.enable_thinking` (`task_config.py`). Runs 12 and 16 sent `true`. The recipe's `think_handling: strip` does not strip anything itself: it only makes the service refuse a run with thinking on and a serving profile that has no reasoning parser (`rules.py`). The actual split is done by the model server.
- **Sampling.** Runs 12 and 16 used temperature 1.0, top_p 0.95, top_k 20, presence penalty 1.5 and 32,768 max tokens, which matches the `qwen3_5_think` profile. The `greedy` profile (temperature 0, thinking off) would give very different replies.
- **Seeds.** The per-request seed fix landed on 28 September 2026, after these runs. Their saved request settings contain no seed, so repeating them will not give the same replies. With 1 repeat, current code sends `seed` from the sampling profile.
- **Errors.** `ignore_errors` is on, so a request that still fails after EvalScope's retries is skipped and the report covers fewer questions. Check `num`.
- **What you can see.** The run page has a Samples view with every question, the reply, the tags and the per-rule table. The IFEval doc's section "What you can see today" is older than this view.

---

## How it compares to the other benchmarks

| | IFEval | IFBench | GSM8K | GPQA-Diamond | MMLU-Pro |
|---|---|---|---|---|---|
| Dataset id | `opencompass/ifeval` | `allenai/IFBench_test` | `AI-ModelScope/gsm8k` | `AI-ModelScope/gpqa_diamond` | `TIGER-Lab/MMLU-Pro` |
| Questions | 541 | 300 | 1,319 | 198 | 12,032 (14 subjects) |
| Examples shown first | none | none | 4 | none | 5 |
| Prompt wrapper | none | none | template | template | template |
| What is graded | whole reply | whole reply | number in `\boxed{}` | letter after `ANSWER:` | letter after `ANSWER:` |
| Graded by | rule code | rule code | number match | letter match | letter match |
| Repeats | 1 | 1 | 1 | 4 | 1 |
| Headline | `prompt_level_strict` | `prompt_level_strict` | accuracy | accuracy | accuracy |

IFBench belongs with IFEval. GSM8K, GPQA-Diamond and MMLU-Pro each have one correct answer per question: the service finds a final number or letter in the reply and compares it with an answer key. IFBench has no answer key and no extraction step. The whole visible reply goes to rule code, and "correct" means "obeyed the rules". Links: [GSM8K](GSM8K_HOW_IT_WORKS.md), [GPQA-Diamond](GPQA_DIAMOND_HOW_IT_WORKS.md), [MMLU-Pro](MMLU_PRO_HOW_IT_WORKS.md), [Overview](BENCHMARKS_OVERVIEW.md).

### IFEval and IFBench in detail

- **Why IFBench exists.** IFEval is from Google (2023). The IFBench authors found that many models did far worse on rules outside IFEval's 25, and read this as models being tuned to those 25. A high IFEval score then no longer showed that a model follows rules in general. IFBench is their answer: new rules, new prompts, same style of checking.
- **Which rules it adds.** None of IFEval's 25 are reused. IFEval's rules are mostly about length, case, punctuation, keywords and layout ("at least 300 words", "no commas", "all lowercase", "wrap in JSON"). IFBench's 58 are fussier: exact counts of numbers or conjunctions, percentage limits on stop words, sentence-by-sentence patterns, copying part of the prompt, and odd formats such as nested parentheses, quoted CSV or reversed text.
- **Size.** IFEval has 541 questions with up to three rules each; IFBench has 300 with one or two. One IFEval question is worth 0.18 points of the headline, one IFBench question 0.33, so IFBench scores jump more.
- **How it is checked.** The same way: Python checkers per rule, strict and loose, the same four numbers. In EvalScope the two have separate adapters and nearly identical grading code. The rule checkers are different code: IFEval's are Google's, IFBench's are Ai2's, and Ai2's have been changed more often since release (see below).
- **The headline.** Same here: `prompt_level_strict`. The IFBench authors say the paper generally reports prompt-level loose accuracy (README note; the first author confirms it in GitHub issue #8). To compare with the paper, use our `prompt_level_loose`, not our headline.
- **What you see.** Same checkpoint name and same sampling: run 15 scored 85.0% on IFEval and run 16 scored 47.0% on IFBench (`Qwen3.5-0.8B-Think-MOPD-mixv2-RL-v11c-s810`). Run 13 scored 85.4% on IFEval and run 12 scored 44.7% on IFBench (`merged_global_step_810`). About 40 points lower is the kind of gap the authors built IFBench to show.

---

## Things worth knowing

### What a good score looks like

I found no reference score from this service; the recipe says "NOT YET RUN". Published numbers, all from outside this repo:

| Source | Model | IFBench | IFEval in the same source |
|---|---|---|---|
| IFBench paper, Table 2 | Tülu-3 8B (DPO) | 25.5 | 81.1 |
| IFBench paper, Table 2 | Qwen2.5 7B trained by the authors on many rules | 53.7 | 87.8 |
| IFBench README leaderboard (Nov 2025) | o3 / Gemini 2.5 Pro / Claude 4 Sonnet | 69.3 / 52.3 / 42.3 | 95.0 / 65.4 / 91.3 |
| Qwen3.5-0.8B model card | Qwen3.5-0.8B / Qwen3-4B-2507 | 21.0 / 50.4 | 44.0 / 87.4 |
| Qwen3.5-4B model card | Qwen3.5-4B | 59.2 | 89.8 |
| Qwen3.5-27B model card | Qwen3.5-27B / GPT-5-mini | 76.5 / 75.4 | 95.0 / 93.9 |
| Qwen3.5-397B-A17B model card | GPT5.2 / Claude 4.5 Opus / Gemini-3 Pro | 75.4 / 58.0 / 70.4 | 94.8 / 90.9 / 93.5 |

None of these sources says whether its IFBench number is strict or loose (the README only notes that the paper generally reports prompt-level loose). The 0.8B card labels its IFBench row "Thinking" and states temperature 1.0, top_p 0.95, top_k 20 and presence penalty 1.5; the other Qwen cards do not label the mode for this row in the copies I read. So a score only means something next to a model size and a metric. IFBench is not saturated: the best numbers in the table are in the mid-70s, while the top models on the Qwen cards score above 90 on IFEval.

Our runs (strict 47.0% and 44.7%, loose 53.3% and 51.7%) are for 0.8B-sized checkpoints, far above Qwen's published 21.0 for the plain 0.8B model. The same card gives 44.0 on IFEval, against about 85% for our runs. The checkpoint names suggest extra training, but I could not confirm what it was, so I cannot say if the gap is real training gains, a different checker version, or a different metric.

### How much a score can jump

- One run's 95% range is about ±5.6 points (run 12: 39.1% to 50.3%; run 16: 41.4% to 52.7%).
- Runs 12 and 16 differ by 2.3 points, but 47 individual questions flipped (20 passed only in run 12, 27 only in run 16). That is the noise a rerun can bring, with the same sampling settings.
- The Compare page calls a gap significant only if it is larger than the two ranges' half-widths combined (about 7.9 points here, so a 2.3-point gap is not significant). Three IFEval runs with the same model name and sampling (runs 10, 11, 13) scored 88.7%, 86.9% and 85.4%; I could not confirm they used identical weights. IFBench, with fewer questions, would spread more.
- Per-rule numbers rest on very few questions. Rules have between 1 and 15 checks each; all 11 `custom` rules have exactly one. The share of rule checks that passed strict, by family (run 12, then run 16): `sentence` 86% and 86%, `count` 60% and 65%, `words` 54% and 55%, `format` 44% and 48%, `ratio` 25% and 34%, `custom` 18% and 18%, `repeat` 0% and 11%. Treat these as hints, not measurements.

### Strict versus loose: the blank line

In my re-grade (a scratch script, not saved in the repo), 13 questions in run 16 and 14 in run 12 flip from fail to pass when only the leading blank line is trimmed: five `format:options`, four `format:no_whitespace`, four `format:no_bullets_bullets`, and in run 12 also one `custom:csv_city`. The four `format:no_whitespace` questions cannot pass strict at all in thinking mode, because the reply always starts with whitespace and the rule forbids it. With the blank line trimmed, the headline would be about 51% for run 16 (from 47.0%) and about 49% for run 12 (from 44.7%). Nothing in the service trims it. The gap between strict and loose in these runs (19 and 21 questions) is mostly this, plus a few replies with a preamble or `*` marks.

### Checker versions

The checkers in the image come from EvalScope commit `2ce95c3` (18 August 2026). Ai2 and EvalScope fixed several rules afterwards, so the image's copy still has these problems:

- Ai2 pull request #34 (a code change on GitHub, merged 30 August 2026) fixed six rules that marked correct replies wrong. `repeat:repeat_span` counted characters instead of words (example 4). `ratio:overlap` compared three-letter pieces instead of three-word pieces. `custom:sentence_alphabet` counted a leading quote mark as the first letter. `words:words_position` counted punctuation as words. `ratio:sentence_words` did not check for repeated words. `count:keywords_multiple` matched inside longer words.
- EvalScope made its own fixes: repeated words (#1676), keywords and person names matched inside longer words (#1755), and further alignment with Ai2's code (#1756).
- `count:pronouns` accepted too few pronouns (Ai2 issue #23, closed).
- `words:start_verb` sometimes misjudges verbs such as "Run" at the start of a sentence. The author of pull request #34 lists it as a known problem; I did not see a fix.
- Instruction-level scores became pooled (EvalScope #1672), and one crash was guarded (#1761).

I re-graded the saved replies of runs 12 and 16 with three checker versions (the image's, EvalScope's current code, and Ai2's current code, all fetched 3 October 2026). The image's version reproduces every stored score exactly. The newer versions change 1 to 4 questions, and the headline by at most 2 questions: run 16 goes from 141 to 141 (EvalScope) or 143 (Ai2) of 300; run 12 goes from 134 to 135 or 136. If the image's EvalScope is ever upgraded, expect small shifts in the headline and a larger shift in `inst_level_*`.

### What is not graded, and leakage

Quality, truth and helpfulness are not checked (examples 1 and 2). A model trained against these checkers can learn to satisfy them with thin answers; the paper's 6.4 against 7.0 judge scores point the same way. For the saved checkpoints, whose names mention reinforcement learning (RL), a high score may partly mean "good at passing these checkers". I could not confirm what data they were trained on.

The test file has been public since July 2025, so a model trained after that could have seen it. The authors used unseen prompts and unseen rules to reduce contamination. I found no source showing contamination, and I found no check for it either.

### Thinking mode

There is no non-thinking IFBench run in `runs/`, so I cannot show its effect on IFBench. On IFEval, the checkpoint in run 9 scored 63.0% (temperature 0, thinking off) and 85.0% in run 15 (temperature 1.0, thinking on). Two settings changed at once, so the gap is not just thinking. With thinking on, every reply starts with a blank line (above). I have not looked at a non-thinking IFBench reply.

### How other teams run it

`docs/BENCHMARK_UNIFICATION_RESEARCH.md` says almost nothing about IFBench. One line says the medical-psychology team runs IFEval, IFBench and BFCL (a tool-calling test) through the tool-call team's own harness (a git submodule and a small translator script). It gives no sampling settings or scores. An older note, readable only through git history (`docs/STANDARDS_AND_PROFILES_RESEARCH.md`), lists IFBench as run by the tool-call and medical-psychology teams with "EvalScope / lm-eval" and marks the numbers as "not the same measurement". It also says the tool-call team's config needs no IFBench row because everything matches the defaults. The two notes disagree about which harness the medical-psychology team uses, and I could not tell which is current.

Outside the team: the IFBench authors generate at temperature 0 and report prompt-level loose accuracy. For thinking models they allow more tokens and cut the reasoning off before scoring (README). For Qwen3-8B and Qwen3-32B the first author gives 32,768 new tokens, the stop sequence `</answer>` and "r1_style" output processing (GitHub issue #5); for the Tülu 3 models, 4,096 new tokens (issue #7). Qwen's 0.8B card uses thinking mode at temperature 1.0 with top_p 0.95, top_k 20 and presence penalty 1.5, which matches our `qwen3_5_think` profile. So the paper's and README's numbers differ from ours in temperature and in strict versus loose; Qwen's numbers match our sampling, but I could not confirm their metric.

### Known gaps in this service

- No reference score for `ifbench/v1`, so there is nothing to compare a run against.
- The headline is strict, and the leading blank line is not trimmed (see above).
- `sample_limit` takes the first rows, which cover only a few rules.
- `dataset_revision` is not pinned; the image tag is the only pin.
- The checkers are older than the fixes above; a checker crash drops a question silently.
- Runs 12 and 16 have no per-request seed.
- `docs/TaskList.md`, checked against the code: item 1 (thinking flag not sent) is fixed, because runs 12 and 16 carry `enable_thinking` in their saved config. Item 2 (split not sent) is fixed, because `eval_split: train` is in the saved config. Item 3 (per-question and per-rule view) is built and works for IFBench. Item 4 (edit or delete profiles and recipes) is not specific to IFBench and I did not check it. The file itself still lists all four as open.

### What I could not confirm

- Why Ai2 replaced the dataset file on 17 October 2025.
- Which serving profile runs 12 and 16 used. The three in `catalog/serving-profiles/` have a context of 32,768 tokens, and the compatibility check needs `max_tokens` plus 2,048 to fit, so they would reject `qwen3_5_think`. The database was not read.
- Whether `merged_global_step_810` and `Qwen3.5-0.8B-Think-MOPD-mixv2-RL-v11c-s810` are the same weights.
- The versions of `emoji`, `syllapy` and `nltk` inside the image.
- Whether ModelScope's copy always matches Hugging Face.
- Whether Qwen's published IFBench numbers are strict or loose.
- What the model server does if the thinking block never closes. It did not happen in these runs.

---

## Where to look in the code

| File | What it does |
|---|---|
| `catalog/standards/ifbench-v1.yaml` | The recipe: dataset id, split, no examples, four metrics, batch size, timeout. |
| `backend/app/services/harness/task_config.py` | Turns the recipe and sampling profile into the EvalScope config (`harness_task_config.json`). |
| `backend/app/services/harness/parser.py` | Reads `reports/<model>/ifbench.json` into the four numbers and the truncation rate. |
| `backend/app/services/compatibility/rules.py` | Refuses bad pairings, such as thinking on without a reasoning parser. |
| `harness/evalscope/Dockerfile` | Builds the image: pinned EvalScope with the `ifbench` extra, NLTK data, baked dataset. |
| `harness/evalscope/bake_nltk.py`, `prefetch_dataset.py` | At build time: download the NLTK data, and load each benchmark's dataset once. |
| `harness/evalscope/run_eval.py` | The entry point inside the container. |
| `harness/evalscope/recheck_instructions.py` | Re-runs the IFEval and IFBench checkers rule by rule on saved replies. |
| `backend/app/services/diagnostics/benchmarks/ifeval.py` | Shared IFEval and IFBench logic: families, tags, pooled and per-question averages. |
| `backend/app/services/diagnostics/benchmarks/ifeval_descriptions.py` | Plain-English wording for all 83 rules (25 IFEval, 58 IFBench). |
| `backend/app/services/diagnostics/report_summary.py` | The 95% range on the headline. |
| `frontend/src/components/IfevalRuleChecklist/` | The per-rule strict and loose table in the sample view. |
| `runs/run-12`, `runs/run-16` | Two full runs (300 questions). `runs/run-1` is a 20-question trial run. |
| `evalscope/benchmarks/ifbench/` (inside the image) | EvalScope's adapter and checkers: `ifbench_adapter.py`, `instructions.py`, `evaluation_lib.py`. |

---

## Sources

All outside the repo. I opened each of these while writing this page, except where noted.

- Paper: [arXiv 2507.02833](https://arxiv.org/abs/2507.02833), read as [HTML](https://arxiv.org/html/2507.02833) (the benchmark description, Table 2, the limitations section, the LLM-as-judge result).
- Dataset: [Hugging Face dataset card](https://huggingface.co/datasets/allenai/IFBench_test), its [commit history](https://huggingface.co/datasets/allenai/IFBench_test/commits/main) (294-row and 300-row versions), and the dataset viewer API at `datasets-server.huggingface.co`.
- ModelScope copy: the metadata at `https://www.modelscope.cn/api/v1/datasets/allenai/IFBench_test`. The web page `modelscope.cn/datasets/allenai/IFBench_test/summary` timed out, so I could not open it.
- Ai2 code and notes: [github.com/allenai/IFBench](https://github.com/allenai/IFBench) (README with the evaluation note and leaderboard, `ifbench/instructions.py`, commit history), [issue 5](https://github.com/allenai/IFBench/issues/5), [issue 7](https://github.com/allenai/IFBench/issues/7), [issue 8](https://github.com/allenai/IFBench/issues/8), [issue 23](https://github.com/allenai/IFBench/issues/23) and [pull request 34](https://github.com/allenai/IFBench/pull/34).
- EvalScope code at the commit in the image: [`2ce95c3`, `evalscope/benchmarks/ifbench`](https://github.com/modelscope/evalscope/tree/2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85/evalscope/benchmarks/ifbench).
- EvalScope fixes after that commit: [#1672](https://github.com/modelscope/evalscope/commit/2949277fa17d46a1b31dfe473b59ffa2f3364b12), [#1676](https://github.com/modelscope/evalscope/commit/440380316b73f67f873bac3ff61adef329c8f0fa), [#1755](https://github.com/modelscope/evalscope/commit/0f0706ea3d90c022b1aca14b923112f473a20e81), [#1756](https://github.com/modelscope/evalscope/commit/1d9edc543e9306e92c4861404c147aae346941dd), [#1761](https://github.com/modelscope/evalscope/commit/e7c07b369bbd110ec51c4a99c947b40be03e8ac2).
- Qwen model cards: [Qwen3.5-0.8B](https://huggingface.co/Qwen/Qwen3.5-0.8B), [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B), [Qwen3.5-27B](https://huggingface.co/Qwen/Qwen3.5-27B), [Qwen3.5-397B-A17B](https://huggingface.co/Qwen/Qwen3.5-397B-A17B).
