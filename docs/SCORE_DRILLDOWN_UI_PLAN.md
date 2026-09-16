# Making a score explainable: a drill-down plan for the UI

Today a finished IFEval run shows you four percentages. This doc is about turning those four
percentages into something you can actually dig into — top-level number first, then one click
deeper, then another, until you are looking at a single question, the model's actual answer, and
a plain-English line saying *this one failed because it used a comma*.

It is written IFEval-first, on purpose. IFEval is the benchmark we understand best and it already
has real runs on disk. But the shape of the thing is meant to outlive IFEval: the top layers
should work unchanged when BFCL v4, tau-bench, or a vision benchmark shows up, and only the
deepest layer should need new code per benchmark.

Nearly every number below was measured from a real run in this repo (`runs/run-13`, checkpoint
`merged_global_step_810`) rather than estimated. Section 11 lists exactly what was verified
directly and what is still an assumption, so nothing here has to be taken on trust.

This is the plan for item 3 on [`docs/TaskList.md`](./TaskList.md). Background on how a run
actually executes is in [`docs/IFEVAL_HOW_IT_WORKS.md`](./IFEVAL_HOW_IT_WORKS.md).

---

## 1. The problem, stated plainly

Here is the entire IFEval result for `run-13` as the product shows it today:

| Metric | Value |
|---|---|
| Prompt-level (strict) | 85.4% |
| Instruction-level (strict) | 91.0% |
| Prompt-level (loose) | 88.4% |
| Instruction-level (loose) | 93.1% |
| Truncation rate | 0% |

That is a good score. It is also almost useless if your next question is "so what do I fix?"

Things a person will immediately want to know, and cannot:

- 85.4% of 541 — so how many questions actually failed? (79.)
- Were they near-misses or total misses?
- Is the model bad at counting words, or bad at format tricks, or bad at following anything with
  two rules at once?
- Show me three failures so I can eyeball them.
- We were at 83% last week and 85.4% now. Which questions flipped?
- Is any of this a real capability change, or is it noise?

And one more that nobody thinks to ask, which turned out to matter most on this very run:

- Is anything about our *plumbing* silently eating points that the model actually earned?

Spoiler, and the single best argument for building this: on `run-13`, **every one of the 541
answers begins with a blank line**, and that one artifact costs the run 12 questions — 2.2 points
of the headline score. No combination of the four numbers above could ever have told you that.
Section 7 walks through how a layered UI surfaces it in four clicks.

---

## 2. What one IFEval run actually gives us

Before designing screens, it is worth being honest about the raw material. A finished run leaves
this on disk under `{output_root}/run-{id}/`:

```
run-13/
├── harness_task_config.json      what we asked the harness to do
├── harness_stdout.log            container stdout (already streamed to the UI)
├── configs/task_config.yaml      what the harness resolved it to
├── logs/eval_log.log             harness's own log
├── reports/<model>/ifeval.json   the summary  ← we read 4 numbers from this
├── predictions/<model>/ifeval_default.jsonl   541 lines: request + reply + timing
└── reviews/<model>/ifeval_default.jsonl       541 lines: the same, plus per-question scores
```

Three of those files are barely touched.

### The report is much richer than four numbers

We copy this whole file verbatim into `eval_run.results_json` and then use four rows out of it.
What else is already sitting in that JSONB column, unused:

| Already in `results_json` | Value on `run-13` |
|---|---|
| Latency spread per request | mean 24.5s, median 19.2s, p90 33.7s, p99 100.4s, max 108.9s |
| Output tokens per answer | mean 2,661, max 7,468 |
| Total tokens for the run | 1,470,238 (30,656 in / 1,439,582 out) |
| Throughput | 108.8 output tok/s, 0.041 req/s |
| Per-metric display hints | "percent", multiply by 100, 1 decimal, higher-is-better |
| Per-subset scores | `default` = 0.854 (IFEval has one subset; MMLU-Pro has 14) |
| Which metric is primary | `prompt_level_strict:mean` |
| A written description of the benchmark | ~1 paragraph, shipped by the harness |

The display hints are worth calling out. The harness already tells us how it wants each number
rendered. Today the frontend hardcodes percent formatting. Reading the hint instead is how a
future benchmark that reports seconds, or tokens-per-second, or a 0–5 score renders correctly
without a frontend change.

### The reviews file is the one that matters

One line per question. Each line carries:

```json
{
  "index": 19,
  "target": "",
  "messages": [ { "role": "user", "content": "make a tweet for playboy's ..." } ],
  "agent_trace": null,
  "sample_score": {
    "score": {
      "value": { "prompt_level_strict": 0.0, "inst_level_strict": 0.5,
                 "prompt_level_loose": 0.0, "inst_level_loose": 0.5 },
      "prediction": "\n\n#thisisfun #playboy #makeitnice #dailyjoy",
      "extracted_prediction": "\n\n#thisisfun #playboy #makeitnice #dailyjoy",
      "explanation": null,
      "main_score_name": "prompt_level_strict"
    },
    "sample_id": 19,
    "group_id": 19,
    "sample_metadata": {
      "key": 1122,
      "prompt": "make a tweet for playboy's twitter account without using capital letters...",
      "instruction_id_list": ["change_case:english_lowercase", "keywords:letter_frequency"],
      "kwargs": [{}, { "let_relation": "at least", "letter": "#", "let_frequency": 4 }]
    }
  }
}
```

So per question we already have, with no re-run and no GPU: the prompt, the answer, four scores,
which rules applied, and each rule's exact settings. The predictions file adds latency, token
counts, stop reason, and — when thinking is on — the reasoning block as a separate field.

### What the full rule inventory looks like

Measured across all 541 questions of a real run:

- **834 individual rules** spread over 541 questions
- **25 distinct rule types**, in **9 families**
- 305 questions carry 1 rule, 179 carry 2, 57 carry 3

That ratio is the reason the instruction-level score is always higher than the prompt-level one,
and the reason a "which rule failed" view has something to say at all.

---

## 3. The five layers

The mental model is a ladder. Each rung answers one question, and every rung is a link to the
next one down. You never have to go deeper than your question needs.

```
                                                                        Shared across
   Layer          The question it answers                                benchmarks?
 ─────────────────────────────────────────────────────────────────────────────────────
   1  The board   "Which checkpoint is best, and did anything move?"       yes, fully

   2  The run     "Is this number trustworthy, and what did it cost?"      yes, fully
      headline

   3  Where the   "Which kind of thing is this model weak at?"            shared shape,
      points went                                                         per-benchmark
                                                                          grouping

   4  The failure "Show me the ones that failed."                          shared shape,
      list                                                                 per-benchmark
                                                                           columns

   5  One sample, "Why did THIS one fail?"                                 per-benchmark
      fully explained                                                      (real work here)
 ─────────────────────────────────────────────────────────────────────────────────────
   Compare mode sits sideways across layers 2–5: same screens, two runs.
```

Layers 1 and 2 are pure arithmetic over things every benchmark has: a primary score, a sample
count, pass/fail counts, latency, tokens. No benchmark knows anything special about them.

Layer 3 is where benchmarks start to differ, but only in *what defines a group*. IFEval groups by
rule family. MMLU-Pro groups by subject. GSM8K has no natural grouping. BFCL would group by
category. The screen, the maths, and the sort order are identical — one small function per
benchmark says what the buckets are.

Layer 4 is a table of samples. The row envelope is genuinely identical across benchmarks (this is
verified, see Section 8), so the table, its filters, its pagination, and its deep links are
written once. Benchmarks only contribute extra columns.

Layer 5 is where you have to write real per-benchmark code, and that is fine — it is also where
all the value is. "This failed because it used a comma" cannot be expressed generically.

---

## 4. Layer by layer: what actually goes on screen

### Layer 1 — The board

Mostly what the leaderboard does today. Three additions worth making:

- **Every cell links to its run.** Right now the leaderboard cell is a dead end. It is the most
  natural entry point to the whole ladder, and it is a one-line change.
- **A confidence interval on the cell.** At n=541, IFEval's own 95% interval is about ±4 points
  (the figure this repo already uses, in `catalog/standards/ifeval-v1.yaml` and
  `docs/EVAL_SERVICE_PLAN.md`). Without it, people read an 85.4 vs 84.1 difference as progress.
  With it, they don't.
- **A delta against the previous run of the same comparison.** "+1.3 since Tuesday," greyed out
  when the delta is inside the interval.

No new data is needed for any of this — the leaderboard endpoint already returns `n_samples` and
`finished_at`.

### Layer 2 — The run headline

The run page keeps its four scores, and gains a band above them that turns percentages into
counts and adds the health signals. From `run-13`:

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  462 of 541 questions followed every rule          85.4%   ±4.0          │
  │  79 failed  ·  16 of those are cosmetic  ·  0 cut off  ·  0 empty        │
  │                                                                          │
  │  Cost    ~3h 40m · 1.44M output tokens · 24.5s mean, 19.2s median        │
  │  Health  no truncation · no empty answers · 2 questions ungradable       │
  └──────────────────────────────────────────────────────────────────────────┘
```

Why counts matter more than percentages here: "79 failed" is a number you can act on. You can
read 79 rows. "14.6%" is a number you can only feel.

The health line is the important new thing. It is a short list of run-level red flags that make a
score untrustworthy regardless of benchmark:

| Signal | Why it invalidates a score | On `run-13` |
|---|---|---|
| Truncation rate | answers cut off mid-sentence fail length and format rules mechanically | 0% — clean |
| Empty answers | request-level errors kept as empty records score 0 and look like model failures | 0 — clean |
| Requests that errored | same | 0 |
| Latency p99 vs median | a p99 of 100s against a 19s median means some requests nearly timed out | 5x — worth a look |
| Ungradable samples | the checker itself couldn't evaluate the rule (see Section 6) | 2 |

All five are computable for any benchmark from files we already write.

### Layer 3 — Where the points went

One screen, two tables, both sorted by *how many points this bucket cost you* rather than
alphabetically. Points lost is the ranking people actually want.

**By rule family** — the "is it length or format?" question:

| Family | Rules passed | Pass rate |
|---|---|---|
| combination | 53 / 65 | 81.5% |
| length_constraints | 121 / 143 | 84.6% |
| punctuation | 56 / 66 | 84.8% |
| language | 27 / 31 | 87.1% |
| keywords | 146 / 163 | 89.6% |
| change_case | 82 / 89 | 92.1% |
| detectable_format | 150 / 157 | 95.5% |
| detectable_content | 51 / 53 | 96.2% |
| startend | 65 / 67 | 97.0% |

**By individual rule** — the same data one level finer, and this is where the real answer lives:

| Rule | Passed | Pass rate |
|---|---|---|
| `length_constraints:nth_paragraph_first_word` | **0 / 12** | **0.0%** |
| `combination:repeat_prompt` | 31 / 41 | 75.6% |
| `keywords:frequency` | 34 / 42 | 81.0% |
| `punctuation:no_comma` | 56 / 66 | 84.8% |
| `language:response_language` | 27 / 31 | 87.1% |
| … 20 more … | | |
| `detectable_content:postscript` | 26 / 26 | 100% |

Look at the top row. One rule out of 25 never passes — not once in 12 attempts. The family table
hides it completely: `length_constraints` looks like a respectable 84.6%, because the other three
length rules in that family score 90.4%, 92.3% and 96.3% and average it back up.

That is the argument for showing both tables. Families are how people think. Individual rules are
where the bug is.

**Two things this layer must be careful about.**

First, **the per-rule numbers do not reconcile with the headline instruction-level score, and the
UI has to say so.** The harness computes `inst_level_strict` as the average of each question's own
pass ratio — 0.9104 on this run. Pooling all 834 rules together instead gives 0.8981. Both are
correct; they are a macro average and a micro average of the same data. A breakdown table is
necessarily the micro view. If we show 89.8% underneath a headline of 91.0% with no explanation,
someone will file a bug. One line of copy — *"this table pools all 834 rules; the headline
averages per question, which weights a 1-rule question the same as a 3-rule one"* — costs nothing
and prevents that.

Second, **attribution has to be real, not inferred.** The tempting shortcut is to blame every rule
on a failed question. It gives visibly wrong answers. Compare the two methods on this run:

| Family | Blame-every-rule (wrong) | Actually checked |
|---|---|---|
| combination | 64.6% | 81.5% |
| length_constraints | 69.9% | 84.6% |
| detectable_format | 87.3% | 95.5% |

The shortcut understates every family, because a question with three rules where one failed drags
the other two down with it. It would also have reported `length_constraints` as the worst family
while completely missing the rule that scores zero. Section 9 covers how to get the real numbers
— it is cheap.

### Layer 4 — The failure list

A table of samples, defaulting to "failures only", with the filters people will actually reach
for: pass/fail, strict vs loose, rule family, rule, "was truncated", "passes loose but not
strict", free-text search in the prompt or answer.

```
  ┌────────────────────────────────────────────────────────────────────────────┐
  │  Showing 79 failures of 541      [only failures ▾] [any rule ▾] [search]   │
  ├──────┬────────────────────────────────┬─────────────┬────────┬─────────────┤
  │ key  │ prompt                         │ rules       │ strict │ tags        │
  ├──────┼────────────────────────────────┼─────────────┼────────┼─────────────┤
  │  181 │ Write an obviously fake news…  │ 1 rule      │  0/1   │ near miss   │
  │ 1040 │ Write me a resume for Matthi…  │ 3 rules     │  2/3   │ near miss   │
  │ 1122 │ make a tweet for playboy's t…  │ 2 rules     │  1/2   │ ungradable  │
  │ 1129 │ Write a short startup pitch …  │ 2 rules     │  1/2   │ ungradable  │
  │ 1219 │ Which one is a better brand …  │ 3 rules     │  2/3   │ near miss   │
  └──────┴────────────────────────────────┴─────────────┴────────┴─────────────┘
```

Every row is a deep link — `/runs/13/samples/1122` should be a URL you can paste into Slack and
have a colleague land on the exact question you are looking at. That one property is most of what
makes a debugging tool feel usable.

### Layer 5 — One sample, fully explained

The bottom of the ladder, and the only screen that needs IFEval-specific code. For a single
question, show the prompt, the answer, and **a tick-list of every rule with the constraint spelled
out in English and what the answer actually did**:

```
  Question 1040                                              FAILED (strict and loose)

  Prompt
    Write me a resume for Matthias Algiers. Use words with all capital letters to
    highlight key abilities, but make sure that words with all capital letters appear
    less than 10 times. Wrap the entire response with double quotation marks.

  Answer                                  3,146 output tokens · 22.7s · stopped: stop
    "This is a simple summary for your profile now"

    ▸ thinking block (3,100+ of those tokens)

  Rules                                                            strict     loose
    ✓  fewer than 10 ALL-CAPS words                                 pass       pass
    ✗  at least 1 ALL-CAPS word          — found 0                  FAIL       FAIL
    ✓  wrapped in double quotes                                     pass       pass

  Why it failed
    One rule of three. The answer is wrapped correctly and stays under the caps limit,
    but contains no ALL-CAPS words at all — it looks like the model treated
    "less than 10 times" as the whole instruction and dropped the "use them" half.
```

The token count on that screen is doing more work than it looks. The answer is one line, and the
run spent **3,146 output tokens** producing it — so over 3,100 of them went into the thinking
block before the model emitted a single-sentence resume. Putting the token count next to the
visible answer is how that becomes obvious. On a benchmark where the answer is supposed to be a
300-word summary, the same juxtaposition is how you spot a model that thought itself out of
answering.

Three things make this screen worth the effort:

1. **The English translation of each rule.** `change_case:capital_word_frequency` with
   `{"capital_relation": "less than", "capital_frequency": 10}` means nothing to a reader.
   "fewer than 10 ALL-CAPS words" means everything. This is a lookup table of 25 short templates,
   written once.
2. **Strict and loose side by side.** When a rule passes loose and fails strict, the model got the
   content right and the wrapper wrong. That is a different bug with a different fix, and the
   headline numbers can only tell you it happened 16 times, never to which questions.
3. **The thinking block, collapsed but present.** When thinking is on, this is where you confirm
   the reasoning text was properly separated from the answer — and the one place you would notice
   if it wasn't.

### Sideways — Compare mode

Two runs, the same five layers, deltas instead of values. The question this answers is "we changed
training, what moved?", and the useful output is not a delta percentage but **the list of
questions that flipped** — so many fail→pass, so many pass→fail, the rest unchanged. The flipped
list is the actual diff of a training change. (No measured example here; comparing two of the
existing runs is a good first sanity check once Phase 2 lands.)

This works because `sample_metadata.key` is stable across runs, so the join is trivial. Worth
designing the per-sample storage with this join in mind even if compare mode ships later.

---

## 5. Why this is layered rather than one big page

One page with everything on it would be a worse product, for a reason worth writing down: **the
layers have different audiences.**

- Someone deciding which checkpoint to ship needs Layer 1 and nothing else, and will be actively
  harmed by a screen full of rule names.
- Someone who just saw a score drop needs Layer 2 to rule out plumbing, then Layer 3 to localize.
- Someone fixing the model lives in Layers 4 and 5 and finds the summaries patronizing.

They also have very different costs. Layers 1 and 2 are a database read. Layer 5 needs file access
and, for IFEval, a re-check pass. Keeping them separate means the cheap screens stay fast and the
expensive work only happens when someone actually asks for it.

---

## 6. Intelligent summaries: computed, not guessed

"Intelligent summary" is the part most likely to go wrong, so let me be specific about what I
think it should and should not be.

**It should be deterministic and computed from the numbers.** Templated sentences driven by
thresholds over data we already have. Same run in, same words out, every time, and any sentence
can be traced to the rows it came from. For an evaluation tool that is not a limitation — it is the
whole point. A summary that paraphrases differently on each page load is not something you can put
in a report.

**It should not be an LLM in the first version.** Asking a model to describe why a model failed
adds a second thing that can be wrong, and the failure mode is confident, fluent, and false. There
is a reasonable place for it later (turning a cluster of 12 failures into a paragraph), but only
once the deterministic layer exists to check it against. Flagging clearly: that is my judgement
call, not a measured result.

### The failure taxonomy

Failures get **tags**, not a single category, because the causes overlap. Deliberately not a pie
chart — a question can be both a near-miss and truncated.

Severity, which is a real partition:

| Tag | Meaning | `run-13` |
|---|---|---|
| Near miss | broke some rules but not all | 54 |
| Complete miss | broke every rule on the question | 23 |
| Ungradable | the checker could not evaluate the rule | 2 |

Cause signals, which overlap freely:

| Tag | How it is detected | Why you care | `run-13` |
|---|---|---|---|
| Cosmetic | fails strict, passes loose | content was right, wrapper was wrong | 16 |
| Cut off | `stop_reason == max_tokens` | mechanical failure, raise the budget | 0 |
| Empty | blank answer | a request error, not a model failure | 0 |
| Whitespace-sensitive | passes when leading whitespace is stripped | our plumbing, not the model | 12 |
| Wrong language | `language:response_language` failed | often a decoding-settings problem | 4 |
| Checker quirk | the rule's own settings are out of range | upstream bug, exclude from blame | 2 |

That last one deserves explanation, because it is a genuine upstream bug we would otherwise never
have noticed. IFEval's letter-frequency checker only accepts letters a–z. Two questions on this run
ask for a count of `#` and `!` respectively. Fed a character outside a–z, the original Google code
falls back to `random.choice(string.ascii_letters)` — so those two questions are graded against
**a randomly chosen letter**, differently on every run. They are permanent noise worth about 0.4
points. Nothing is broken on our side; the honest thing is to tag them and exclude them from
per-rule blame.

### What the generated summary reads like

Given those tags, this is machine-writable from thresholds alone:

> **79 of 541 questions failed.** Two thirds of them (54) were near misses that broke some of
> their rules while following the rest, which means the model is mostly getting these instructions
> and tripping on specifics rather than ignoring them.
>
> **One rule accounts for 12 failures and never passed once.**
> `length_constraints:nth_paragraph_first_word` is 0 for 12. All 12 answers pass the same check
> once leading whitespace is removed, and all 541 answers on this run begin with a blank line —
> so this is almost certainly our response handling, not the model. Worth 2.2 points.
>
> **16 failures are cosmetic** — they pass the forgiving checker and fail the strict one, meaning
> the model added a preamble or closing line around an otherwise correct answer.
>
> **Two questions are ungradable** and will differ between runs no matter what. Excluded from the
> rule breakdown.
>
> **Nothing looks wrong with the run itself.** No answer was cut off, none came back empty, and
> the slowest request finished in 109 seconds against a 1,800-second timeout.

Every clause there is a threshold over a count. No inference, no model, and the numbers are the
ones in Sections 3 and 4.

---

## 7. A real walkthrough

To show the ladder doing its job, here is the actual path through `run-13` that found the
leading-blank-line problem.

**Layer 1.** 85.4% on IFEval. Fine. Click it.

**Layer 2.** 462 of 541 passed, 79 failed, no truncation, no empty answers. So the run is healthy
and the 79 are real failures worth looking at. Click "79 failed".

**Layer 3.** The per-rule table sorts `length_constraints:nth_paragraph_first_word` to the top at
**0 out of 12**. Every other rule is above 75%. A rule that never passes is not a weakness, it is a
bug. Click the rule.

**Layer 4.** All 12 questions carrying that rule, all failed. Click the first one, key 181.

**Layer 5.** The prompt asks for exactly six paragraphs with the second starting with
"President". The answer is:

```
\n\nThis is a complete fake account for you to see how it works...
\n\nPresident John Doe is actually saying something that could really help...
\n\nThe science experts claim that there is a lot of truth behind this...
...
```

The model did it correctly. Six paragraphs, second one starts with "President". But the answer
begins with `\n\n`, so splitting on blank lines yields seven chunks with an empty one at the
front — which makes the paragraph count wrong and shifts "the second paragraph" onto the first
real one. The model earned this point and the plumbing took it away.

**Confirming it.** Re-running the checkers on all 541 saved answers with nothing changed except
`lstrip()` on the response:

| | Prompt-level strict |
|---|---|
| Answers as saved | 464 / 541 = 85.8% |
| Leading whitespace stripped | 476 / 541 = 88.0% |

**+2.2 points, 12 questions, from one leading blank line.** All 541 answers on this run have it.

That is four clicks and one cheap experiment, and it is the kind of finding that changes what you
work on next. It is also completely invisible in the four numbers we ship today — and notice that
`prompt_level_loose` already knew, because the loose checker strips the first line. The information
was in the summary all along, sitting as a 3-point strict/loose gap that nobody could explain.

(A caveat on the arithmetic: the recompute says 464 where the stored score says 462. The difference
is exactly the two randomly-graded questions from Section 6. Worth stating in the UI rather than
quietly rounding away.)

---

## 8. What is shared and what is per-benchmark

This is the design question that decides whether the next benchmark is a week of work or a day.

### The evidence for a shared layer

I compared the per-sample review files for IFEval and MMLU-Pro from real runs. The envelope is
**identical**:

| Field | IFEval | MMLU-Pro |
|---|---|---|
| `index`, `messages`, `agent_trace` | same | same |
| `sample_score.sample_id`, `group_id` | same | same |
| `sample_score.score.prediction` | the answer text | the answer text |
| `sample_score.score.extracted_prediction` | same as prediction | the extracted letter |
| `sample_score.score.explanation` | `null` | `null` |
| `target` | `""` (no right answer) | the correct option |
| **`sample_score.score.value`** | **4 IFEval metrics** | **`{"accuracy": 0.0}`** |
| **`sample_score.sample_metadata`** | **key, prompt, rules, kwargs** | **subject, question_id, cot_content** |

Only the last two rows differ. Everything Layers 1, 2, and 4 need lives in the rows that don't.

### The seam

The one thing I would push back on in the original framing: the shared layers should **not** read
the harness's files directly. BFCL and tau-bench will likely arrive under a different harness, and
if Layer 4 knows what an EvalScope review line looks like, every shared screen breaks the day a
second harness shows up.

So put an adapter at the bottom whose only job is *harness output → our own per-sample shape*, and
have every layer above read our shape:

```
   EvalScope files ─┐
                    ├─→  adapter  ─→  normalized sample records  ─→  Layers 1,2,4  (shared)
   lm-eval files  ──┤                        │
                    │                        └─→  benchmark module  ─→  Layers 3,5  (specific)
   future harness ──┘
```

The adapter is per harness. The benchmark module is per benchmark. Everything else is written once.
This is the same Adapter shape the codebase already uses for harness wrappers.

A normalized sample record needs roughly:

| Field | Notes |
|---|---|
| `sample_key` | stable across runs — this is what makes compare mode a join |
| `subset` | IFEval `default`; MMLU-Pro `psychology`; tau `retail` |
| `passed` | the primary metric as a boolean, for "show me failures" |
| `scores` | the raw `score.value` dict, untouched |
| `input_summary` | one line for the table |
| `output_summary` | one line for the table |
| `tokens_in`, `tokens_out`, `latency_seconds`, `stop_reason` | health signals, harness-provided |
| `benchmark_details` | opaque to shared layers; Layer 5's input |

### What each benchmark module owns

Two functions, and a renderer:

| Piece | IFEval | MMLU-Pro | BFCL v4 (expected) | tau-bench (expected) |
|---|---|---|---|---|
| Buckets for Layer 3 | rule family, then rule | subject | category (simple / parallel / relevance) | domain, then task |
| Failure tags | cosmetic, near miss, whitespace-sensitive, checker quirk | wrong option, no answer extracted | bad JSON, wrong function, wrong args, hallucinated tool | goal not reached, policy violation, wrong turn |
| Layer 5 renderer | per-rule tick list | question, options, chosen vs correct | the tool call, expected vs actual, argument diff | the conversation, turn by turn |

### Where I expect this to strain

Being honest about the limits rather than claiming it generalizes cleanly:

- **Layer 4's row is single-turn-shaped.** "Prompt" and "answer" as one line each works for IFEval,
  MMLU-Pro, GSM8K. For tau-bench a sample is a whole conversation. The envelope already carries
  `messages` and `agent_trace` (both populated for agentic benchmarks, `null` for IFEval), so the
  data is there — but the *renderer* will need a multi-turn variant. I would plan for three sample
  renderers by family (single-turn text, multi-turn/tool, multimodal) rather than one per
  benchmark or one for all.
- **Vision benchmarks need image rendering**, which is a real addition to Layer 4 and 5, not a
  config change. Layers 1–3 should be unaffected.
- **Layer 5 needs the checkers to be re-runnable.** True for IFEval (Section 9). Unknown for a
  benchmark whose grader is an LLM judge — there, Layer 5 shows the judge's stored reasoning
  instead, which is why `score.explanation` is worth keeping in the normalized record even though
  IFEval always leaves it `null`.
- **A benchmark with no natural grouping** (GSM8K) should render Layer 3 as "no breakdown
  available" and skip straight to Layer 4, not show a one-row table.

---

## 9. How to build it

### The one genuinely new capability: recovering which rule failed

Everything in Layers 1–4 is already on disk. Layer 5's tick list is the exception, because the
harness computes the per-rule booleans and then throws them away — it averages `[true, false,
true]` into `0.667` and keeps only the average. That is why a review line can tell you "2 of 3
passed" but not which two.

The fix is to re-run the same checkers on the saved answers. **I verified this end to end.** The
function is `test_instruction_following_strict(inp, response)` in
`evalscope.benchmarks.ifeval.utils`, and it returns a `follow_instruction_list` of per-rule
booleans before anything averages them.

Measured on the real 541-sample run:

- **0.34 seconds** for all 541 samples, CPU only, no model, no GPU
- **540 of 541 reproduce the stored aggregate exactly**; the one that doesn't is the
  random-letter question from Section 6

Two implementation details that matter:

1. **The checkers live inside the harness image, not in the backend.** `evalscope` is deliberately
   not a backend dependency, and the image is where the pinned checker code and the baked NLTK
   corpora live. So the re-check runs as a short-lived container from the same image the run used,
   the way runs already work. This also means the re-check is pinned to the same checker version
   that produced the original score, which is the property you want.
2. **Seed `random` before the pass.** Two questions hit the random-letter fallback. Without a seed
   the same run re-checks to slightly different numbers, which will read as a bug.

### Storage

Layers 1 and 2 are small numbers, and `results_json` already holds everything they need — no
schema change, just read the column we already fill.

Layers 3–5 need per-sample data, and there are three options:

| Option | Good | Bad |
|---|---|---|
| Read the JSONL per request | no schema change, no new writes | re-reads and re-parses on every click; filtering and sorting in Python; cross-run compare is awkward |
| Precompute one diagnostics JSON per run | computed once, cheap to serve | still no server-side filtering; compare mode reads two blobs |
| A `run_sample` table, text left on disk | filtering, sorting, and cross-run joins are plain SQL | a migration, and a backfill for the 13 existing runs |

My recommendation is the table, with a caveat. 541 rows per run is nothing, and Layer 4's filters
and compare mode's flip list are exactly what a database is for — doing them in Python means
rebuilding indexes and pagination by hand. The caveat is to **keep the long text out of the table**:
store scores, flags, tags, token counts, and the rule results, and read the prompt and answer from
the JSONL only when someone opens a single sample. That keeps a run's row set in the tens of
kilobytes instead of the tens of megabytes the predictions file occupies.

If that feels like too much for a first cut, option 2 is a reasonable stepping stone that doesn't
paint us into a corner — the diagnostics JSON is the same shape the table rows would be.

### Suggested phases

Each phase is independently shippable and useful on its own.

**Phase 1 — free numbers.** Surface what `results_json` already holds: pass/fail counts next to
each percentage, latency and token spread, the health line, confidence intervals, and the
leaderboard cells becoming links. No new files read, no schema change. This alone answers "how many
failed" and "is this run trustworthy".

**Phase 2 — the sample list.** Read the reviews file, normalize it, build Layer 4 with filters and
per-sample deep links. Shared code only — no IFEval-specific logic yet. Lands the per-sample view
for IFEval, IFBench, GSM8K, GPQA, and MMLU-Pro at the same time, since the envelope is shared.

**Phase 3 — the breakdown.** The per-rule re-check pass, then Layer 3's two tables and the true
per-rule numbers. This is the phase that would have caught the 0-of-12 rule.

**Phase 4 — the sample detail.** Layer 5: the tick list, the 25 English rule templates, strict
versus loose side by side, the thinking block.

**Phase 5 — summaries and compare.** The taxonomy tags, the generated paragraph, and the
fail→pass flip list between two runs.

### Where the code goes

Following the existing layering (`app/api/v1/` → `app/controllers/` → `app/services/`):

```
backend/app/services/diagnostics/
  normalize.py        harness review files → normalized sample records (per harness)
  summary.py          Layer 1/2 numbers — benchmark-agnostic
  buckets.py          Layer 3 grouping — dispatches to a benchmark module
  tags.py             the failure taxonomy — shared signals + benchmark hooks
  narrate.py          the templated summary sentences
  benchmarks/
    ifeval.py         buckets, tags, rule templates, the re-check pass
```

Frontend, following the ~200-line component guidance:

```
frontend/src/pages/RunDetailPage.tsx          gains Layer 2's band
frontend/src/pages/RunDiagnosticsPage.tsx     Layers 3 and 4
frontend/src/pages/RunSamplePage.tsx          Layer 5
frontend/src/components/RunHealthBand/
frontend/src/components/FailureBreakdown/
frontend/src/components/SampleList/
frontend/src/components/SampleDetail/
frontend/src/components/IfevalRuleChecklist/  the one IFEval-specific component
```

Worth noting: `recharts` is already a dependency, though currently only used by the `/vision`
prototype. Layer 3's tables are honestly better as sorted HTML tables with inline bars than as
charts — a bar chart of 25 rule names is less readable than the list, and the list can carry the
raw counts that make it verifiable.

---

## 10. Decisions to make before building

1. **Is the shared normalized record worth building in Phase 2, or do we shape Phase 2 around
   IFEval and generalize when the second benchmark needs it?** I lean toward building it now,
   because four other benchmarks are already in the catalog and would light up for free — but it
   is real extra work up front for a payoff that arrives later.
2. **Table or precomputed JSON for per-sample data?** Recommendation above is the table; the JSON
   is the lower-commitment start.
3. **When does the re-check run — at run completion, or lazily on first view?** At completion is
   simpler to reason about and makes the data always-there; lazily avoids spending it on runs
   nobody opens. Either way the existing 13 runs need a backfill path.
4. **Do we correct for the checker quirks we find, or only report them?** Reporting is clearly
   right for the leaderboard — the published number should stay comparable with everyone else's.
   But the leading-blank-line finding is a genuine plumbing bug worth fixing at the source, which
   *will* move scores. That needs a deliberate decision, not a silent fix.
5. **Does compare mode belong on the leaderboard or as its own page?** Affects Phase 5's shape.

---

## 11. What was verified, and what wasn't

Verified directly against real files and a real container:

- The four headline scores, sample counts, latency and token statistics quoted for `run-13`,
  including the per-sample timing and token counts used in the Layer 5 example
- 541 questions, 834 rules, 25 rule types, 9 families, and the 305/179/57 split by rule count
- 79 failures; 54 near misses, 23 complete misses, 2 ungradable; 16 passing loose but not strict
- `length_constraints:nth_paragraph_first_word` at 0 of 12, cross-checked against the stored
  per-question scores with zero disagreements
- All 541 answers begin with a newline; stripping it moves prompt-level strict from 464 to 476
- The per-rule re-check works, takes 0.34s for 541 samples, and reproduces 540 of 541 stored scores
- `inst_level_strict` is a macro average (0.9104), not the pooled micro average (0.8981)
- The two random-letter questions, and the upstream code path that causes it
- The review-file envelope is identical between IFEval and MMLU-Pro
- Today's UI shows four scores and a truncation rate, and nothing reads the reviews file

Not verified — flagging these rather than presenting them as fact:

- **Everything about BFCL v4 and tau-bench** is inference from how those benchmarks are generally
  shaped. Their bucket definitions and failure tags in Section 8 are educated guesses. The layer
  split should hold; the specifics will need revisiting when a real run exists.
- **Vision benchmarks** — no concrete knowledge of what we would run. The claim that Layers 1–3
  are unaffected is reasoning, not evidence.
- **The ±4 point confidence interval** for IFEval at n=541 is taken from the existing planning
  docs and the IFEval standard's own comments, not recomputed here.
- **The ~3h 40m wall clock** in the Layer 2 mock is derived from the report's own requests-per-
  second figure, not from the run row's start and finish timestamps.
- **Whether the leading blank line comes from the reasoning-parser split** is the obvious
  explanation and fits every observation, but I did not trace it through the serving stack to
  confirm. It may be related to item 1 on `docs/TaskList.md`.
