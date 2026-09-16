# How IFEval works in this service

This is a walkthrough of what actually happens when someone runs IFEval here. No jargon for its own sake — just the path a request takes, where the questions live, what they look like, and what we get back after the model answers.

---

## What IFEval is testing

IFEval is not a quiz about knowledge. It does not care whether an answer is clever, true, or well written.

It cares about **rules**.

Each question is a normal writing task with one or more mechanical constraints bolted on, for example:

- write the whole answer in lowercase
- do not use any commas
- write exactly three paragraphs
- include the words "correlated" and "experiencing"
- wrap the whole reply in quotation marks
- repeat the question word-for-word, then answer

A human grader would argue about quality. A computer can check these rules with no debate: either the answer has a comma, or it doesn't.

That is the whole test. Follow the constraints, pass. Break one of them, fail.

There are **541 questions**. Together they cover about **25 kinds of rule**, things like length, punctuation, keywords, case, and format. Many questions stack two or three rules at once.

The headline score is simple: **what fraction of questions followed every rule in that question**. That number is called `prompt_level_strict`. If the model gets 480 of 541 fully right, the score is about 88.7%.

---

## The short version of the flow

When you submit an IFEval run from the UI (or `POST /api/v1/runs`), this is the trip:

```
You click Submit
        │
        ▼
Backend creates a run row ("queued") and starts a worker
        │
        ▼
Worker starts (or reuses) a model server on the GPU cluster
        │
        ▼
Worker writes a task config file and starts an EvalScope container
        │
        ▼
EvalScope loads the 541 questions from its own baked-in copy
        │
        ▼
EvalScope sends those questions to the model over HTTP,
up to 32 at a time, each question as its own chat request
        │
        ▼
The model answers. EvalScope grades each answer with rule checkers
        │
        ▼
EvalScope writes files to disk. We pick four headline numbers
out of them and show those on the run page.
```

Two machines are involved, and they do different jobs:

- **The GPU cluster** only serves the model. It does not know this is IFEval. It just answers chat requests.
- **EvalScope**, running in a container on our server, owns the questions, sends them, and grades the answers. It never loads the model itself. It talks to the model the same way any OpenAI-style client would.

That split is why a text benchmark like this can run without putting EvalScope on a GPU.

---

## Step by step: how a request actually travels

### 1. Someone submits a run

The submit form (or API) names:

- which **checkpoint** (the model weights)
- which **standard** (`ifeval/v1` — this is our written-down recipe for "what IFEval means here")
- which **sampling profile** (temperature, thinking on/off, token budget, and so on)
- which **serving profile** (how to start the model server)

The backend checks that this combination is allowed, then inserts a run. It returns immediately. The work happens in the background.

The IFEval recipe itself lives in `catalog/standards/ifeval-v1.yaml`. That file is the source of truth for "how we run IFEval": dataset name, no prompt wrapper, the four scores we keep, 32 requests in flight, and so on.

### 2. The worker brings up a model server

The worker looks for a live endpoint that already has this checkpoint served the same way. If one exists, it reuses it. If not, it submits a SLURM job on the cluster, waits until vLLM is answering, and opens an SSH tunnel so our server can reach it.

From EvalScope's point of view the model is just a URL, something like `http://backend:<port>/v1`.

### 3. The worker builds a task config and starts EvalScope

The backend does **not** import EvalScope. It writes a JSON file the EvalScope container can read, then runs:

```
docker run ... registry.local/evalscope:2ce95c3-tier1 /work/harness_task_config.json
```

That JSON is the whole instruction sheet. For IFEval it says, in substance:

- talk to this URL, using this model name
- run the `ifeval` dataset
- dataset id: `opencompass/ifeval`
- split: `train` (see below — the name is misleading)
- no extra prompt wrapping
- 0-shot (no worked examples)
- send up to 32 questions at a time
- sampling settings from the sampling profile
- write everything under `/work`

The tiny script inside the image (`harness/evalscope/run_eval.py`) just loads that JSON and calls EvalScope's `run_task()`. All the real choices were already made on our side.

### 4. EvalScope asks the model, then grades

For each question, EvalScope sends a normal chat completion: one user message, which is the question text as-is. No system prompt. No "please reason step by step". Nothing wrapped around it.

That empty wrapper is on purpose. If we added "You are a helpful assistant" around a question that says "reply in all lowercase", our own wrapper could break the rule we are trying to test.

After the model replies, EvalScope runs the IFEval checkers on the answer text. If thinking mode was on, vLLM has already split the `<think>...</think>` block into a separate field, so the checker sees the answer, not the scratchpad. (A think block full of commas would otherwise fail "no commas" every time.)

### 5. We read the output and store a few numbers

When the container exits, the worker:

1. Reads the report file and pulls out four scores
2. Skims the predictions file to see how many answers hit the token limit
3. Saves those into Postgres
4. Marks the run done

The run page shows the four scores, the truncation rate, and the settings that were used. It does not currently show the 541 individual questions.

---

## Where the questions live

They are **not** in this git repo.

They are baked into the EvalScope Docker image at build time.

The dataset id is `opencompass/ifeval` on ModelScope (a copy of Google's IFEval set). When we build the harness image, `harness/evalscope/prefetch_dataset.py` downloads it through the same loader a real run uses, and leaves it in the image's cache.

So at run time:

- the container does not need the internet
- every run sees the same 541 questions
- the image tag (`evalscope:2ce95c3-tier1`) is how we pin "this exact copy of the data"

The split is named **`train`**. That sounds like training data. It isn't. IFEval only published one split, and they called it `train`. We use all of it. There is no hidden test set.

`sample_limit: null` in the standard means "use the full 541". A smoke run can override that to 20, which is useful for wiring checks and useless as a real score.

---

## What a question looks like

Each item is a prompt plus a list of rules the grader will check. There is no "correct answer" string. The target is empty. The rules *are* the answer key.

Here is a real one, shortened a little:

**The question the model sees:**

> Write a 300+ word summary of the wikipedia page "https://en.wikipedia.org/wiki/Raymond_III,_Count_of_Tripoli". Do not use any commas and highlight at least 3 sections that has titles in markdown format, for example *highlighted section part 1*, *highlighted section part 2*, *highlighted section part 3*.

**The rules hiding behind that text:**

| Rule id | What it means for this question |
|---|---|
| `punctuation:no_comma` | zero commas anywhere in the reply |
| `detectable_format:number_highlighted_sections` | at least 3 markdown-highlighted sections |
| `length_constraints:number_words` | at least 300 words |

A simpler one:

> Given the sentence "Two young boys with toy guns and horns." can you ask a question? Please ensure that your response is in English, and in all lowercase letters. No capital letters are allowed.

That one has a single rule: `change_case:english_lowercase`.

And one that stacks format tricks:

> Write me a resume for Matthias Algiers. Use words with all capital letters to highlight key abilities, but make sure that words with all capital letters appear less than 10 times. Wrap the entire response with double quotation marks.

Rules: use ALL-CAPS words at least once, use them fewer than 10 times, wrap everything in `"..."`.

The stored record for each question looks roughly like this:

```json
{
  "key": 1000,
  "prompt": "Write a 300+ word summary ...",
  "instruction_id_list": [
    "punctuation:no_comma",
    "detectable_format:number_highlighted_sections",
    "length_constraints:number_words"
  ],
  "kwargs": [
    {},
    { "num_highlights": 3 },
    { "relation": "at least", "num_words": 300 }
  ]
}
```

`instruction_id_list` is the list of checkers. `kwargs` is the settings for each checker, in the same order — "at least 300 words", "3 highlights", and so on.

The model never sees that JSON. It only sees `prompt`. The JSON is for the grader.

### The kinds of rules

The 25 checkers fall into a handful of families:

| Family | Examples |
|---|---|
| Keywords | must include a word, must not include a word, use a letter N times |
| Length | N words, N sentences, N paragraphs |
| Format | bullet list, JSON, title in `<<angle brackets>>`, highlighted sections |
| Case | all lowercase, all caps, ALL-CAPS words at a given frequency |
| Punctuation | no commas |
| Start / end | wrap in quotes, end with a specific phrase |
| Combination | give two answers separated by `***`, or repeat the prompt then answer |
| Language | reply in a given language |
| Content | include `[placeholders]`, add a P.S. |

Some questions have one rule. Some have two or three. A question only **passes at prompt level** if every rule on it passes.

---

## Batch or one-by-one?

**Each question is its own HTTP request.** We do not glue 32 questions into one prompt.

What `eval_batch_size: 32` means is: **up to 32 of those requests can be in flight at once**.

Think of 541 letters to post. We don't write one giant letter containing 541 questions. We write 541 separate letters, and we keep 32 of them in the post at the same time. When one comes back, we send the next.

On our side that is concurrency, for speed. On the GPU side, vLLM may happen to pack several of those live requests into one forward pass — that is the server's own batching, and it is not something IFEval controls.

A few related knobs, so they don't get mixed up:

| Setting | What it actually does |
|---|---|
| `eval_batch_size: 32` | how many questions EvalScope has waiting on the model at once |
| `repeats: 1` | each question is asked once, not several times |
| `sample_limit: null` | all 541 questions; a number here would cap it |
| `max_num_seqs` on the serving profile | how many sequences the GPU server will handle together |

Order does not matter for the score. Each question is graded on its own. Asking question 17 before question 4 does not change whether question 4 passes.

---

## How an answer is graded

After the model replies, EvalScope runs the original IFEval checkers (the Google ones, vendored into EvalScope).

There are two strictness levels.

**Strict.** Look at the answer as-is. Did it follow the rule? Yes or no.

**Loose.** Try a few light cleanups first — drop the first line, drop the last line, strip asterisks — and pass if *any* of those versions follow the rule. This is a more forgiving upper bound. It exists because models sometimes add a short preamble or a closing line that would otherwise fail a format rule.

Then those per-rule yes/no results are rolled up four ways:

| Score | In plain language |
|---|---|
| **prompt_level_strict** | Of all 541 questions, how many followed *every* rule, with no cleanup? **This is the headline.** |
| **prompt_level_loose** | Same, but using the forgiving checker. |
| **inst_level_strict** | Across every individual rule on every question, what fraction passed? A 3-rule question that got 2 right contributes 2/3, not a full fail. |
| **inst_level_loose** | Same, forgiving checker. |

So if a question has three rules and the model breaks the "no commas" one:

- prompt-level strict for that question = **fail** (0)
- instruction-level strict for that question = **2/3**

That is why instruction-level scores are always a bit higher than prompt-level scores. Partial credit exists at instruction level. The headline number does not give partial credit.

The checkers are code, not another model. No judge LLM. No "does this look right". Count the words, scan for commas, check the quotes.

---

## What we get back after a run

EvalScope writes a folder per run, under `{output_root}/run-{id}/`. Three files matter.

### 1. The report — four headline numbers

`reports/<model-name>/ifeval.json`

This is the summary. Our parser copies the whole file into `eval_run.results_json` and then lifts four rows into the `metric` table:

- prompt_level_strict
- inst_level_strict
- prompt_level_loose
- inst_level_loose

Each row also has `n_samples` (541 on a full run).

The report can also carry timing extras (latency, tokens in/out). We store them in that JSON blob. We do not show them in the UI today.

The run page and the leaderboard only use those four scores, plus **truncation rate** (how many answers were cut off for hitting `max_tokens`). Truncation is our number, counted from the predictions file, not one of EvalScope's four metrics.

### 2. Predictions — every question and every answer

`predictions/<model-name>/ifeval_default.jsonl`

One JSON line per question. This is the raw evidence. A line has:

- the prompt the model actually saw
- the full model reply
- `instruction_id_list` and `kwargs` (which rules applied)
- token counts
- why it stopped (`stop` vs `max_tokens`)

This file is on disk, not in Postgres. One IFEval run is tens of megabytes, and it belongs in files, not in a database row.

### 3. Reviews — every question with its scores

`reviews/<model-name>/ifeval_default.jsonl`

Same 541 lines, plus the four scores for *that* question. Example of a mixed result:

```json
{
  "prompt_level_strict": 0.0,
  "inst_level_strict": 0.666...,
  "prompt_level_loose": 0.0,
  "inst_level_loose": 0.666...
}
```

That tells you: this question failed overall, but two of its three rules passed. It does **not** tell you *which* two.

Our backend currently **does not read this file**. It sits on disk next to the predictions and is unused by the API and the UI.

---

## What you can see today vs what is sitting on disk

This is the important distinction.

| Level | Exists after a run? | Shown in the UI / API today? |
|---|---|---|
| Four headline scores | yes | **yes** — run page and leaderboard |
| Truncation rate | yes | **yes** — run page |
| Per-question pass/fail | yes, in `reviews/` | no |
| The actual question text and the model's answer | yes, in `predictions/` and `reviews/` | no |
| Which rule family is weak (punctuation vs length vs …) | can be computed from disk | no |
| Which *specific* rule failed on a multi-rule question | not saved as a list of yes/no flags | no — needs a cheap extra pass |

So: EvalScope is more detailed than the four numbers we publish. Our service currently throws most of that detail on disk and then only promotes the summary.

---

## Can we get more fine-grained information?

Yes. We do not need another GPU run to do it. The answers are already saved.

There are three useful extra layers, from cheap to slightly more work.

### Layer A — per question (already on disk)

Read `reviews/*.jsonl`. For each of the 541 lines you already have:

- the prompt
- the answer
- pass/fail under strict and loose
- the instruction-level fraction (1.0, 0.66, 0.5, 0.0, …)
- which rule *types* were on that question (`instruction_id_list`)

That alone lets you build a table: "here are the 61 questions this run failed", with the question text and the answer next to them. It also lets you compare two runs question by question — which items flipped from pass to fail.

This is the "per sample" view. The data is there. Nothing in the product reads it yet.

### Layer B — per rule type (easy to compute)

Each rule id starts with a family name: `punctuation:no_comma`, `length_constraints:number_words`, `combination:repeat_prompt`.

If you group the 541 questions (or the individual rules) by that family, you get a breakdown like:

- combination rules: 66%
- length rules: 73%
- punctuation: 79%
- keywords: 82%
- everything else: high 80s / low 90s

The original IFEval paper reports numbers this way. EvalScope's summary file does **not**. We would compute it ourselves from the reviews or by re-checking the answers. Either way, no GPU.

This is the view that answers "is the model bad at counting, or bad at format tricks?" The four headline scores cannot tell you that.

### Layer C — per individual rule on a question (almost there)

This is the missing bit.

EvalScope's grader *does* check each rule separately. Internally it builds a list like `[true, false, true]` for a three-rule question. Then it immediately averages that list into `0.666` and throws the list away.

So from the saved review you know "2 of 3 passed". You do not know whether it was the comma rule, the word-count rule, or the highlight rule that failed.

To recover that, we re-run the same checkers on the saved answer. That is CPU-only, seconds not minutes, and it needs no model. We already have everything the checker wants: the answer text, the rule ids, and the kwargs.

After that pass you can say, for every question:

> Question 1000: no-comma **fail**, 3 highlights **pass**, 300 words **pass**.

That is the "per instruction" view. It is the difference between "this question failed" and "this question failed because the model used a comma".

---

## What "more fine-grained" would look like in the product

If we surfaced this, a run page could grow from four numbers into something you can actually debug:

1. **Still show the four headline scores.** Those are what the leaderboard and the paper use. Don't replace them.
2. **A per-question table.** Prompt, answer, pass/fail, which rules were on it.
3. **A rule-family chart.** Length vs punctuation vs combination, so a training change has a fingerprint.
4. **Per-rule ticks on each question.** The true/false list from Layer C.

None of that changes the official score. It just makes a 3-point gap explainable — "we lost 18 questions, and 11 of them were length rules" — instead of a single percentage that you have to take on trust.

The files are already being written. The gap is that we parse the summary and ignore the rest.

---

## A few things that are easy to misunderstand

**The questions are not "batched" into one model call.** They are sent in parallel as separate chats.

**`train` is not a training split.** It is the whole eval set, badly named by the dataset authors.

**IFEval does not grade quality.** An answer can be nonsense and still pass, as long as it obeys the mechanical rules. An excellent answer with one extra comma fails.

**Thinking text is not supposed to be graded.** If thinking is on, the serving stack strips it before EvalScope sees the reply. If that strip fails, almost every format rule will fail.

**One extra word can flip a score.** "Exactly three paragraphs" is not "about three paragraphs". That is why two runs of the same model at temperature 1.0 can differ by a handful of questions without anything being broken.

**Our UI is showing a summary of a summary.** EvalScope already scored every question. We currently keep four averages.

---

## Where to look in this repo

| What | Where |
|---|---|
| The IFEval recipe we actually run | `catalog/standards/ifeval-v1.yaml` |
| Turning that recipe into an EvalScope config | `backend/app/services/harness/task_config.py` |
| Starting the EvalScope container | `backend/app/services/harness/runner.py` |
| The tiny EvalScope entrypoint | `harness/evalscope/run_eval.py` |
| Baking the 541 questions into the image | `harness/evalscope/prefetch_dataset.py` |
| Reading the four scores back out | `backend/app/services/harness/parser.py` |
| The submit → worker pipeline | `backend/app/services/runs/submit.py`, `.../worker.py` |
| What the run page displays today | `frontend/src/pages/RunDetailPage.tsx` |
