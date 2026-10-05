# How GPQA-Diamond works in this service

This is a plain-English walkthrough of the GPQA-Diamond benchmark: what it tests, where its questions live, what the model is asked, and how a reply turns into a score. It only covers what is specific to GPQA-Diamond. The general trip every run takes (submit, model server, EvalScope container, report files) is the same for all benchmarks and is explained in [How IFEval works](IFEVAL_HOW_IT_WORKS.md). Sibling guides: [IFBench](IFBENCH_HOW_IT_WORKS.md), [GSM8K](GSM8K_HOW_IT_WORKS.md), [MMLU-Pro](MMLU_PRO_HOW_IT_WORKS.md) and the [Overview](BENCHMARKS_OVERVIEW.md).

**The short version.** GPQA-Diamond is 198 very hard multiple-choice science questions (biology, physics, chemistry). Every question has four options. The model is told to think step by step and to end with a line like `ANSWER: C`. The service asks each question four times, which makes 792 requests, and reports the share of replies whose letter matches the answer key. Pure guessing scores 25%.

Two things to know before reading on:

- **This document contains no real GPQA question.** The dataset card says: "We request that you do not reveal examples from this dataset in plain text or images online, to reduce the risk of leakage into foundation model training corpora." So every example below is made up. It copies the format of the real thing but is far easier.
- **There is no finished GPQA-Diamond run in this repo.** `runs/run-6` stopped after 290 of 792 replies, and the recipe says its reference score is "NOT YET RUN". Anything taken from run-6 is marked as partial. No number here is a real GPQA score for any model.

---

## What GPQA-Diamond is testing

It is a hard-science exam. The questions need a multi-step calculation or a chain of specialist knowledge, the kind of problem a PhD student would struggle with outside their own field. The model must pick the one correct option out of four. The three wrong options are written to look believable.

**What it tests.** Whether the model can work through a hard science problem and land on the right option, in three sciences only. I counted the 198 questions in the data file: chemistry 93 (organic chemistry alone is 72), physics 86 (quantum mechanics 25, general physics 19, high-energy particle physics 14, astrophysics 13, smaller areas) and biology 19 (molecular biology 15, genetics 4).

**What it does not test.** Writing or explaining: only the final letter is graded. Looking things up: the model answers closed-book. Knowing when it is unsure: it must always pick a letter. Real research work: the authors do not claim the questions represent how science is done in practice. Anything outside biology, physics and chemistry, or outside English.

**Who made it, and why.** GPQA ("Graduate-Level Google-Proof Q&A") was made by David Rein and colleagues at New York University. The paper appeared on arXiv in 2023 and at the COLM conference in 2024. The authors wanted questions for research on *scalable oversight*: how can people check the work of an AI that knows more than they do? For that you need questions that experts can answer but skilled non-experts cannot, even with a search engine.

61 contractors hired through Upwork, each with or working towards a PhD, wrote and checked the questions. A writer wrote each question with the right answer, three wrong answers and an explanation. A first expert in the same field answered it and gave feedback. The writer revised it. A second expert answered the revised version. Finally three skilled non-experts (experts from *other* fields) tried it with unrestricted web access but no AI assistants, for 37 minutes per question on average.

**What "Diamond" means.** The authors released three nested sets:

| Set | Questions | Rule for getting in |
|---|---|---|
| Extended | 546 | Everything collected. 564 were written and 18 were held back. |
| Main | 448 | At least 1 of the 2 experts agrees with the answer key, and at most 2 of the 3 non-experts got it right. |
| **Diamond** | **198** | Both experts agree with the answer key, and at most 1 of the 3 non-experts got it right. |

"Agrees" also counts an expert who first answered differently, then clearly explained their own mistake after seeing the key. Diamond is the strictest cut: questions that most likely have one clear right answer and that most skilled non-experts get wrong.

**Why "Google-proof".** Skilled non-experts with a search engine still scored only 34.1% on the Extended set (guessing: 25%). Experts scored 64.8%. So the answer cannot simply be looked up. The paper also lists 81.3% for experts and 22.1% for non-experts on Diamond, but marks those two numbers as skewed, because Diamond was chosen using those very answers.

---

## At a glance

| Question | Answer |
|---|---|
| Recipe | `catalog/standards/gpqa_diamond-v1.yaml` (`gpqa_diamond/v1`) |
| Questions | 198 (chemistry 93, physics 86, biology 19) |
| Dataset used | `AI-ModelScope/gpqa_diamond` (a ModelScope copy), split `train` |
| Examples shown first | none (0-shot) |
| Reply expected | step-by-step reasoning, then a last line `ANSWER: X` (X is A, B, C or D) |
| Tries per question | 4 (`repeats: 4`), so 792 requests per run |
| Graded by | plain code comparing letters, no judge model |
| Headline number | `accuracy`: share of the 792 replies with the right letter |
| Thinking text | removed before grading (`think_handling: strip`) |
| Reference score | none yet. The recipe says "NOT YET RUN". |

---

## Where the questions live

### The original home and the copy used here

The original is the paper (<https://arxiv.org/abs/2311.12022>), the code and data repo (<https://github.com/idavidrein/gpqa>, where the data is a password-protected zip) and Hugging Face (`Idavidrein/gpqa`, config `gpqa_diamond`). The Hugging Face files are gated: I got "401 unauthorized" when I tried to download them without logging in.

The copy this service uses is `AI-ModelScope/gpqa_diamond`, split `train`, on ModelScope (Alibaba's hub for models and datasets): <https://www.modelscope.cn/datasets/AI-ModelScope/gpqa_diamond>. It is a re-upload dated 30 January 2025. As far as I can tell the GPQA authors do not maintain it. I read its file list, its card and the data file itself.

- It has one data file, `train.jsonl` (about 1.9 MB), with 198 lines, one per question, and 78 columns per row.
- The columns that matter are `Question`, `Correct Answer` and `Incorrect Answer 1` to `3`. The others hold the writer's explanation, the domain and sub-domain, the feedback from both experts and all three non-experts, and a "canary" marker string that dataset authors use to help keep the data out of training sets. The model sees none of those.
- Unlike the Hugging Face copy, it downloads without an account.

### How the data gets into the EvalScope container

It is baked into the Docker image when the image is built, not downloaded during a run. `harness/evalscope/prefetch_dataset.py` loads GPQA-Diamond (and the other four benchmarks' data) through the same code path a real run uses, and leaves the result in the image's cache folder (`/opt/hf-cache/modelscope`). At run time EvalScope looks in that cache first. The image tag (`evalscope:2ce95c3-tier1`) is the version pin: the recipe sets `dataset_revision: null` because EvalScope has no setting for a ModelScope revision.

Two things I could not confirm. The script's own comments say the "no network at all" test of the finished image has not been done yet. And run-6's log does not say whether the data came from the cache or from the internet. I did check that the question text in run-6's prompts matches today's ModelScope file exactly, for all 75 questions that appear in the partial run.

### Why the split is called `train`

The ModelScope copy is a single file named `train.jsonl`, so its only split is `train`. The original Hugging Face dataset also has only a `train` split, and the lm-evaluation-harness code carries a comment saying so. It is not training data. It is the whole 198-question exam, and the service uses all of it. EvalScope's code notes that a separate `validation` copy exists on ModelScope but is private.

### Where results land

Everything is under `runs/run-<id>/`, which is git-ignored:

| File | What it holds |
|---|---|
| `harness_task_config.json` | exactly what was sent to EvalScope |
| `predictions/<model>/gpqa_diamond_default.jsonl` | one line per request: the full reply (thinking and visible parts), token counts, why it stopped |
| `reviews/<model>/gpqa_diamond_default.jsonl` | the same requests with the extracted letter, the answer key and the score |
| `reports/<model>/gpqa_diamond.json` | EvalScope's summary, written only when the run ends normally |
| `diagnostics/<model>/gpqa_diamond.json` | the service's own per-question summary, built from the reviews. The Samples tab reads it. |

The database keeps the headline score, the sample count, the whole report as JSON and the truncation rate. The per-question files stay on disk: 27 MB for run-6's 290 replies, so I estimate about 70 MB for a full run. They contain the real questions and answers.

---

## What a question looks like

**About these examples.** They are made up and much easier than real GPQA questions. A real one is usually a dense paragraph that needs specialist knowledge (in the Diamond file the median question is about 380 characters, the longest 1,642, before the options). I kept the format and invented the content. The option order is real in one sense: I ran the service's own shuffle rule on each made-up question, so the order below is what the service would produce for exactly this wording. The replies are invented too.

### What one stored row looks like

The raw row lists the right answer first, then the wrong ones. Abridged and made up:

```json
{
  "Question": "A hospital stores a radioactive tracer with a half-life of 6.0 hours. At 08:00 the activity of one vial is measured as 400 MBq. What activity should be expected from the same vial at 02:00 the next morning?",
  "Correct Answer": "50 MBq",
  "Incorrect Answer 1": "200 MBq",
  "Incorrect Answer 2": "100 MBq",
  "Incorrect Answer 3": "25 MBq",
  "Explanation": "18 hours is three half-lives, so 400 / 2^3 = 50 MBq.",
  "Subdomain": "Physics (general)",
  "...": "about 70 more columns (expert and non-expert feedback, revision notes, ...)"
}
```

### What the model receives

EvalScope fills a fixed template and sends one user message: no system message and no examples. The message is the instruction paragraph, a blank line, the question, a blank line, then the four options on separate lines (`A) ...` to `D) ...`), with no trailing newline. I checked this layout against a real run-6 prompt. Example 1 shows a whole message.

### How the options get their letters

The raw row has no positions, so EvalScope builds a list (the three wrong answers, then the right one), shuffles it and labels the result A to D. The shuffle is not random from run to run. Its seed is computed from the question text (a SHA-256 fingerprint of it). So a given question has the same layout for every model, every run and all four repeats. Across the 198 questions the right answer lands on A 51 times, B 43, C 63 and D 41, which is uneven by chance and identical for every model.

Why order can change a score: models have habits, such as leaning towards a letter. A June 2025 study of DeepSeek-R1-Distill models (arXiv 2506.04734) found that on GPQA-Diamond, option order and the position of the right answer alone moved scores by more than 5 points. A fixed layout keeps runs comparable, but a model's letter habit is never averaged out. Other evaluators do the opposite: OpenAI's `simple-evals` gives every repeat a new order, and Epoch AI reorders the options from run to run.

I checked the shuffle against run-6. Applying the rule to the question text reproduced the answer letter and the option order of all 290 saved prompts.

### Example 1: a clean, correct reply

The model receives (answer key: **D**):

```
Answer the following multiple choice question. The last line of your response should be of the following format: 'ANSWER: [LETTER]' (without quotes) where [LETTER] is one of A,B,C,D. Think step by step before answering.

A hospital stores a radioactive tracer with a half-life of 6.0 hours. At 08:00 the activity of one vial is measured as 400 MBq. What activity should be expected from the same vial at 02:00 the next morning?

A) 100 MBq
B) 200 MBq
C) 25 MBq
D) 50 MBq
```

A made-up visible reply (a thinking model first writes a long thinking part, not shown):

```
From 08:00 to 02:00 the next morning is 18 hours, which is 3 half-lives of 6.0 hours.
The activity halves each time: 400 -> 200 -> 100 -> 50 MBq.

ANSWER: D
```

**Grading.** The last line starts with `ANSWER:`, so the first and strictest rule finds `D`. The key is `D`. They match, so the reply scores 1.

### Example 2: well written, but wrong and oddly formatted

The model receives the same first paragraph (left out here), then (answer key: **A**):

```
A buffer is made by dissolving 0.20 mol of an acid HA (pKa = 4.76) and 0.10 mol of its sodium salt NaA in water, then diluting to 1.00 L. What is the pH of the buffer?

A) 4.46
B) 4.76
C) 5.06
D) 3.76
```

A made-up visible reply:

```
Use the Henderson-Hasselbalch equation: pH = pKa + log([HA]/[A-]).
[HA] = 0.20 M and [A-] = 0.10 M, so pH = 4.76 + log(2.0) = 4.76 + 0.30 = 5.06.

**Answer: C**
```

**Grading.** The last line is wrapped in bold marks, so it does not start with `ANSWER:` and the strictest rule misses it. The looser rule (the word `answer:` anywhere in a line) finds `C`. The key is `A`, because the model flipped the ratio. `C` is not `A`, so the reply scores 0. The reasoning was never looked at.

### Example 3: cut off while thinking

The model receives the same first paragraph, then (answer key: **C**):

```
A bacterial culture starts with 1,000 cells. It stays in a 40-minute lag phase with no growth, and then the number of cells doubles every 20 minutes. Assuming no cells die and no nutrient runs out, how many cells are present 2 hours after the start?

A) 64,000
B) 8,000
C) 16,000
D) 32,000
```

A made-up reply, with both parts shown:

```
thinking part (hidden from the grader):
  Growth starts at minute 40. From minute 40 to minute 120 is 80 minutes, so 4 doublings, so 16,000.
  Wait, does the lag phase count inside the 2 hours? Let me check again.
  Growth starts at minute 40. From minute 40 to minute 120 is 80 minutes, so 4 doublings, so 16,000.
  Wait, does the lag phase count inside the 2 hours? Let me check again.
  ... the same lines repeat until the 16,384-token limit cuts the reply off ...

visible part: (empty)
stop reason: max_tokens
```

**Grading.** The visible part is empty, so there is no answer line and no fallback letter. The reply scores 0, even though the thinking pointed at the right option. It also counts towards the run's truncation rate.

### What the real replies in run-6 looked like

Described in my own words, because they repeat the real questions. This is the partial run (290 replies), model `Qwen3-4B-allternary-ep03`, thinking on.

- 211 replies finished by themselves. The thinking part was about 19,000 characters (median) and the visible part about 1,200 characters, roughly 7 lines: a short step-by-step write-up, often with bold text and a few formulas, then an answer line. The median was 5,600 tokens (a token is a piece of a word, roughly three quarters of one). None used more than about 9,800.
- 79 replies (27%) hit the 16,384-token limit. In 73 of them the model was still thinking, so there was no visible text at all.
- The cut-offs look like loops, not like healthy reasoning that needed a little more room. I zipped the last 6,000 characters of each thinking part: for 72 of the 79 cut-off replies the text shrank to under 5% of its size, which is what text that repeats itself does. None of the 189 finished replies with that much thinking did. I did not read the loops, and I did not test whether a higher token limit would help.

---

## What the model has to produce

A reply that ends with `ANSWER:` and one capital letter, A to D. Only the **visible** part of the reply is read.

With thinking on (the `qwen3_think` sampling profile) a reply has two parts: a **thinking part**, the model's private working-out, which the grader ignores, and a **visible part**, the write-up that ends with the answer line. The model server (vLLM, started with `--reasoning-parser qwen3`) splits the two, and EvalScope saves them as two parts of one reply. The recipe's `think_handling: strip` promises that the thinking part is not graded. The service enforces it: a thinking profile paired with a serving profile that has no reasoning parser is rejected at submit time, because the thinking text would otherwise be read as part of the answer. With thinking off (the `greedy` profile) the step-by-step working goes straight into the visible part.

| Situation | What happens |
|---|---|
| A clean `ANSWER: X` last line | read normally |
| The answer line is bold, or sits inside a longer line | usually still read (rules below) |
| No `ANSWER:` marker anywhere | the last capital letter in the visible text is used if it is A to D, otherwise no answer |
| `ANSWER:` followed by anything but one capital letter A to D | no answer, scored wrong |
| The model runs out of tokens while thinking | visible part empty, so no answer, scored wrong |
| The model runs out of tokens while writing the visible part | what was written is read. Usually the answer line is missing, so wrong. |
| The request itself fails | retried up to 5 times, 10 seconds apart. If it still fails, the question is skipped, not scored. |

---

## How the grading works

No judge model is involved. Plain code reads the reply and compares letters.

```
reply
  |-- thinking part ------------------------> ignored
  `-- visible part
        1. look for the answer (four tries, in order)
        2. is it exactly one capital letter, A to D?    no -> no answer -> 0
        3. same letter as the answer key?               yes -> 1, no -> 0
        4. average the scores of all 792 replies  ->  accuracy
```

### Steps 1 to 3: from reply to 0 or 1

EvalScope's `parse_answers` tries four things in order. The first that finds something wins:

1. A line that starts with `ANSWER:` (the word can be in any capitalisation), then letters, then the end of the line or a full stop. If several lines match, the first counts.
2. The same with a bracketed letter, such as `ANSWER: (B) some text`.
3. `ANSWER:` anywhere inside a line, for example `**Answer: D**`.
4. If there is no `ANSWER:` at all, the last capital letter in the visible text, accepted only if it is A, B, C or D.

Two details. Whatever follows `ANSWER:` must be exactly one capital letter from A to D. So `ANSWER: C is correct` is read as the text "C is correct" and scores wrong, and so does `ANSWER: c`. And once try 1, 2 or 3 has found an `ANSWER:` marker, try 4 is never used, even when what follows is not a letter.

Then EvalScope's `Accuracy` scorer gives 1 when the extracted letter equals the key letter for that question (the position where the right answer landed after the shuffle), and 0 otherwise.

### What this did on run-6

I re-ran EvalScope's rules on run-6's 290 saved replies. My re-run agrees with the saved letter on all 290.

| How the letter was found | Replies | Right | Wrong |
|---|---|---|---|
| a line starting with `ANSWER:` | 165 | 66 | 99 |
| `ANSWER:` inside a line (mostly bold) | 29 | 13 | 16 |
| `ANSWER:` found, but not followed by a single A to D letter | 2 | 0 | 2 |
| no `ANSWER:`, so the last capital letter was used | 17 | 3 | 14 |
| nothing usable (all cut off by the token limit) | 77 | 0 | 77 |
| **Total** | **290** | **82** | **208** |

The last-letter fallback was right 3 times out of 17, about what guessing gives (25% of 17 is about 4). It rescues some format slips, but it is not reliable.

82 of 290 is 28.3%. **That is not a score.** The run stopped early, 79 of the 290 replies were cut off and counted wrong, and the first replies to arrive are not a random sample of the exam.

### The headline number and the others

- **Headline:** `accuracy`. In the recipe it is the metric `accuracy`, EvalScope's key is `accuracy:mean`, it is the primary metric, higher is better, and it is stored between 0 and 1. It is the only metric the recipe lists.
- **Also kept:** the whole EvalScope report as JSON, and the service's own truncation rate (the share of replies whose stop reason is `max_tokens`).

### Repeats: why every question is asked four times

The recipe sets `repeats: 4`. EvalScope copies each question four times in a row, so a run has 4 x 198 = 792 requests. The four copies are identical prompts. Their answers differ only because the model's sampling is random (temperature 0.6 in `qwen3_think`; temperature is how much randomness goes into each word choice).

**Pooling** means putting all 792 scored replies in one pile and taking the plain average. A question answered right on 3 of its 4 tries adds 3 right answers to the pile. The headline is right answers divided by 792. Because every question is asked exactly four times, this equals the average of the 198 per-question results (0, 0.25, 0.5, 0.75 or 1). If a few requests fail and are skipped, the two ways of averaging differ slightly. The service uses the plain average over all scored replies.

**Why do it.** 198 questions is a small exam, and a thinking model answers the same question differently each time. In run-6, 68 questions got all four replies. For 23 of those 68, the four replies were right on some tries and wrong on others. One draw per question would be partly luck. Four draws take out most of that luck.

**What repeats cannot fix.** The 198 questions are still a small sample (see "How jumpy is the score?"). With the `greedy` profile (temperature 0, always the most likely word) the four tries come out nearly identical, so repeats add almost nothing. The recipe says this too.

**A side effect.** When `repeats` is above 1 the service does not send a fixed random seed with each request, because a fixed seed would make the four copies identical. The cost is that a GPQA run cannot be reproduced exactly. The submit form shows a warning about this.

---

## How a run goes here

Only the GPQA-specific parts. The rest is in [How IFEval works](IFEVAL_HOW_IT_WORKS.md).

- **Examples first:** none (`few_shot: 0`). EvalScope's GPQA code has a 5-shot mode, but the recipe never uses it.
- **Requests:** 792 per run, 32 in flight at a time (`eval_batch_size: 32`, which the recipe calls an unmeasured default). Each may take up to 1,800 seconds. The slowest reply in run-6 took 318 seconds, so the token limit is what bites, not the time limit.
- **Sampling:** the recipe adds nothing (`sampling_overrides: {}`). The settings come from the sampling profile picked at submit time:

| Profile | Temperature | Top-p / top-k | Token limit | Thinking |
|---|---|---|---|---|
| `qwen3_think` (run-6's saved settings match it) | 0.6 | 0.95 / 20 | 16,384 | on |
| `greedy` (the recipe says its reference score should use this one) | 0 | 1.0 / off | 8,192 | off |

- **Thinking:** `think_handling: strip`, with the reasoning-parser rule described above.
- **Parts of the benchmark:** one, called `default`, so there are no sub-scores. The service cannot split a score by chemistry, physics and biology: the data file has those labels, but EvalScope's review files only carry each question's right and wrong answers.
- **Failed requests:** the run uses `ignore_errors: true`, so a question whose request fails leaves the average. It is not counted wrong.
- **Time:** run-6 completed about 12 replies a minute. At that speed a full run takes roughly an hour or more.

---

## How it compares to the other benchmarks

| | [IFEval](IFEVAL_HOW_IT_WORKS.md) | [IFBench](IFBENCH_HOW_IT_WORKS.md) | [GSM8K](GSM8K_HOW_IT_WORKS.md) | GPQA-Diamond | [MMLU-Pro](MMLU_PRO_HOW_IT_WORKS.md) |
|---|---|---|---|---|---|
| Tests | following writing rules | following new, unseen rules | grade-school maths | graduate-level science | broad knowledge and reasoning |
| Questions | 541 | 300 | 1,319 | 198 | 12,032 |
| Model answers with | free text | free text | a number | one letter, A to D | one letter, A to J |
| Graded by | rule checkers | rule checkers | number comparison | letter comparison | letter comparison |
| Examples in prompt | 0 | 0 | 4 | 0 | 5 |
| Tries per question | 1 | 1 | 1 | 4 | 1 |
| Requests in flight | 32 | 32 | 32 | 32 | 128 |
| Headline | prompt-level strict | prompt-level strict | accuracy | accuracy | accuracy |

**Against IFEval and IFBench.** They have no answer key. Code checks whether a reply obeys rules such as "no commas" or "three paragraphs". GPQA has one right letter. IFEval sends each prompt as it is, with no wrapper, while GPQA wraps every question in the instruction paragraph. All of them read only the visible part of a reply.

**Against GSM8K.** Also "reason, then give a final answer", but the answer is a number graded by numeric comparison, and the model gets four worked examples first. GPQA gives none. GSM8K has 1,319 problems, so one try is enough.

**Against MMLU-Pro, the closest sibling.** Both are multiple choice. Both use the same opening sentence of the prompt, the same `ANSWER: X` last line, the same letter-finding code and the same `accuracy` metric. Once a letter is found, the two are scored in exactly the same way. The differences:

- **Number of options.** GPQA has 4, so guessing scores 25%. MMLU-Pro has up to 10 (A to J; 9.47 on average according to its paper), so guessing scores about 10%.
- **Size and noise.** 198 questions against 12,032. The 95% margin from question sampling alone is about 7 points for GPQA and under 1 point for MMLU-Pro (at a score near 50%). That is why GPQA gets four repeats and MMLU-Pro one.
- **What the questions are.** GPQA is a small set written from scratch by experts to be hard even with web search, in three sciences. MMLU-Pro is broad: 14 subjects from law to physics. Most of its questions come from the older MMLU exam (6,810 kept, after removing trivial and ambiguous ones). 5,222 were added from other sources such as STEM websites, TheoremQA and SciBench. Its wrong options were expanded from 3 to 9 with GPT-4 and then reviewed by experts. So GPQA tests depth in three sciences and MMLU-Pro tests breadth.
- **Examples in the prompt.** GPQA shows none. MMLU-Pro shows five worked examples from the same subject, taken from its `validation` split.
- **Option order.** GPQA's options are shuffled by EvalScope, with a fixed shuffle per question. MMLU-Pro's keep the dataset's own order. I found no shuffling in its code.
- **Parts and openness.** GPQA has one part. MMLU-Pro has 14 subjects, and the headline averages over all questions, so big subjects such as maths (1,351 questions) count more than small ones such as history (381). MMLU-Pro's questions are on its public dataset card. GPQA's authors ask that theirs are not published.

---

## Things worth knowing

### What is a good or bad score?

There is no reference score for this service yet. These yardsticks come from sources, each with its own setup, so none is directly comparable to a run here:

| Reference point | Score | Source |
|---|---|---|
| Guessing | 25% | the paper and Epoch AI |
| Skilled non-experts with web search (Extended set) | 34.1% | GPQA paper, Table 2 |
| PhD-level experts (Extended set) | 64.8% | GPQA paper, Table 2 |
| PhD-level experts recruited by OpenAI (Diamond) | 69.7% | quoted on Epoch AI's GPQA-Diamond page |
| Best GPT-4-based baseline in the paper (2023) | 39% | GPQA paper |
| Qwen3-4B, thinking mode, 10 samples per question, Qwen's own settings | 55.9% | Qwen3 technical report, Table 17 |
| Qwen3-4B, non-thinking mode, same method | 41.7% | Qwen3 technical report, Table 18 |
| One frontier model, July 2025, 8 repeats, 128,000-token limit | 87% (plus or minus 2) | Epoch AI, Grok 4 entry |

A score far below 25% almost always means a format or cut-off problem, not a model worse than guessing (Epoch AI says its strict scoring does the same thing). The Qwen3-4B rows are the nearest yardstick for the checkpoint named in the recipe, but the settings differ (token limit, repeats, prompt, scoring). I also do not know what the "allternary" part of that checkpoint's name means.

### How jumpy is the score?

One question is worth 0.5 points (100 / 198). At about 40% accuracy, the 95% margin from the choice of questions alone is about plus or minus 6.8 points (1.96 x the square root of 0.4 x 0.6 / 198). So two models 5 points apart can easily be equal. Four repeats do not shrink that part. They only remove the luck of one sampling draw.

### Known weaknesses of the benchmark

- **Nearly maxed out at the top.** In May 2025 Epoch AI saw the best models clustered around 83%, which led one of the benchmark's creators to suspect something was wrong with the other 17%. Epoch measured 87% for one model in July 2025. The Hugging Face page now shows a leaderboard with top entries above 90%, but I could not tell which GPQA set or scoring rules it uses. At the top, small gaps are mostly noise. This matters less for a 4B-class model, whose score is far from the ceiling.
- **Some questions are flawed.** The authors (blog post, May 2024) estimate that between 74% and 100% of Diamond is truly objective, and guess it is near the top, without measuring it. Epoch AI's informal read (May 2025) was that probably at least 90% are valid, with a rough guess of 8% invalid and a lot of uncertainty. One unofficial audit on Hugging Face (`adamallcock/gpqa-diamond-clean`) says 9 of the 198 are broken (1 wrong key, 1 malformed, 7 with more than one defensible answer). It was checked by models, not experts, so treat it as a hint only. The authors take corrections through a form linked from their GitHub page. Two questions in the ModelScope copy also list the same wrong option twice, so they really have only three distinct options.
- **Heavy on organic chemistry.** It is 72 of the 198 questions (36%), and Epoch AI found it makes up 70% of the 40 questions that models get wrong most often. Epoch offers two possible reasons: organic chemistry often needs spatial or diagram-style reasoning, which models find hard, or questions in that area are invalid more often. It could not tell which.
- **Leakage is possible.** The authors gate the files and add a canary string to guard against training on the data, but the ModelScope copy downloads freely. I cannot rule out that some models have seen the questions.

### When "wrong" just means a format problem or running out of room

In run-6, 77 of the 208 wrong answers had no letter at all, and every one of them was a cut-off reply. Another 14 were wrong after the last-letter fallback had to guess. So a score depends on the token limit and on following the `ANSWER:` format, not only on science knowledge. The truncation rate stored next to each score exists to show this. Read the two together.

### Thinking mode

A thinking model writes thousands of tokens before answering. Qwen's own report gives Qwen3-4B 55.9% with thinking and 41.7% without. The price is length and the risk of loops. In run-6 the median reply used 7,100 tokens and 27% hit the limit. Raising the limit would cost a lot of time and, since the cut-offs look like loops, might not rescue many of them (not tested). Turning thinking off (the `greedy` profile) moves the working into the visible reply, with an 8,192-token limit.

### How other teams run it differently

- **`one-bit-models` team** (the recipe calls it the low-bit team): lm-evaluation-harness, task `gpqa_diamond_zeroshot`. That task lets the model write nothing. It compares how likely the model finds "(A)", "(B)", "(C)" and "(D)" after the question and picks the likeliest. It is 0-shot, with no step-by-step reasoning. A separate task, `gpqa_diamond_cot_zeroshot`, does allow reasoning (I did not read it closely). The recipe calls the zeroshot task "the more directly comparable pair". I doubt that: it is a different kind of test.
- **`tool-call` team:** EvalScope, as this service does (see `docs/BENCHMARK_UNIFICATION_RESEARCH.md`).
- **OpenAI `simple-evals`:** same prompt family. 4 repeats by default, a new option order for each repeat, a regex that finds `Answer: X`, and no last-letter fallback.
- **Epoch AI:** same prompt family, strict scoring (no `ANSWER: X`, no credit), option order reshuffled from run to run, several repeats (8 for the Grok 4 entry).
- **Qwen3 report:** 10 samples per question.

Numbers from different setups are only comparable when the prompt, scoring rule, thinking mode, token limit, option order and repeats all match.

### Gaps and surprises in this service

I checked `docs/TaskList.md` against the code. Items 1 and 2 (the thinking switch and the split name not being sent) look already fixed: the code sends both, and run-6's saved config shows `enable_thinking: true` and `eval_split: "train"`. Items 3 and 4 are about other things and I did not look into them.

- **No finished run and no reference score.** Run-6's log stops about 23 minutes in with no error message. I could not find out why (I did not read the database). The recipe wants the reference score from the `greedy` profile, but run-6 used `qwen3_think`. The report-level key `accuracy:mean` has not been seen in a finished GPQA report. Finished MMLU-Pro and GSM8K reports use the same key, and run-6's review files use the name `accuracy`, so I expect it to work.
- **The margin of error is probably too narrow.** The service computes the interval from the stored sample count. EvalScope's plain average counts every reply, so a finished run should store 792, not 198. That makes the interval about half as wide as the honest one (about 3.4 points instead of 6.8 at 40%). The leaderboard's "How to read this" note says GPQA's samples are "not fully independent" and its interval is "approximate", but not that it is probably too narrow. This is my reading of the code. No finished GPQA run exists to confirm it.
- **The fallback is lenient, and some slips are harsh.** Strict evaluators give no credit without `ANSWER: X`. Here, 17 run-6 replies were read through the fallback and 3 were right. In the other direction, `ANSWER: C is correct` scores wrong.
- **The summary text is misleading for cut-offs.** The diagnostics page says empty answers are "usually a request error rather than a model failure". In run-6 no request failed. All 73 empty answers were thinking that hit the token limit.
- **Failed requests are skipped, not counted wrong.** This can flatter a run in which many requests fail.
- **Recipe wording.** The `sample_limit` comment ("null = the full 198 questions. Never null on a published run.") contradicts itself. I think it means "never set a limit on a published run".
- **The dataset copy.** The ModelScope card's header says Apache 2.0 while its text says CC BY 4.0 (the original's licence). Its text also describes 448 questions (the Main set), although the file has the 198-question Diamond set. Hugging Face's own card describes 448 as well, so do not trust card text for Diamond. The copy is pinned only by the image tag, not by a revision.
- **The real questions sit on disk** in the saved `predictions/` and `reviews/` files. `runs/` is git-ignored, which keeps them out of the repository. Keep it that way.

---

## Where to look in the code

| What | Where |
|---|---|
| The GPQA-Diamond recipe | `catalog/standards/gpqa_diamond-v1.yaml` |
| Sampling profiles | `catalog/sampling-profiles/` (`qwen3_think.yaml`, `greedy.yaml`) |
| Recipe to EvalScope settings | `backend/app/services/harness/task_config.py` |
| Starting the EvalScope container | `backend/app/services/harness/runner.py` |
| Dataset baked into the image | `harness/evalscope/prefetch_dataset.py`, `harness/evalscope/Dockerfile` |
| Reading the report, truncation rate | `backend/app/services/harness/parser.py` |
| Seed-versus-repeats rule | `backend/app/services/standards/capabilities.py` |
| Submit-time checks (reasoning parser, seed warning) | `backend/app/services/compatibility/rules.py` |
| Per-question summary, tags, summary text | `backend/app/services/diagnostics/` (`evalscope_reviews.py`, `registry.py`, `tags.py`, `narrate.py`) |
| The margin of error shown in the UI | `backend/app/services/diagnostics/report_summary.py`, `backend/app/services/leaderboard/queries.py` |
| The Samples tab | `frontend/src/pages/RunSamplesTab.tsx` |
| Real output (partial run) | `runs/run-6/` |

---

## Sources

Read for this document, outside the repo (opened in October 2026):

- GPQA paper: <https://arxiv.org/abs/2311.12022>
- Dataset card (Hugging Face): <https://huggingface.co/datasets/Idavidrein/gpqa>
- Code and data repo: <https://github.com/idavidrein/gpqa>
- Author blog post on mistakes in benchmarks: <https://wp.nyu.edu/arg/can-good-benchmarks-contain-mistakes/>
- The copy this service uses (file list, card, `dataset_infos.json`, `train.jsonl`): <https://www.modelscope.cn/datasets/AI-ModelScope/gpqa_diamond>
- EvalScope at the pinned commit: <https://github.com/modelscope/evalscope/tree/2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85>. Files read: `evalscope/benchmarks/gpqa/gpqa_adapter.py`, `evalscope/benchmarks/mmlu_pro/mmlu_pro_adapter.py`, `evalscope/utils/multi_choices.py`, `evalscope/metrics/aggregators/aggregators.py`, `evalscope/api/benchmark/adapters/default_data_adapter.py`, `evalscope/evaluator/evaluator.py`
- lm-evaluation-harness GPQA tasks: <https://github.com/EleutherAI/lm-evaluation-harness/tree/main/lm_eval/tasks/gpqa>
- OpenAI `simple-evals` (`gpqa_eval.py`, `common.py`): <https://github.com/openai/simple-evals>
- Epoch AI: <https://epoch.ai/benchmarks/gpqa-diamond>, <https://epoch.ai/gradient-updates/gpqa-diamond-whats-left>, <https://epoch.ai/gradient-updates/why-benchmarking-is-hard>
- Qwen3 technical report: <https://arxiv.org/abs/2505.09388>
- Study of option order and answer position: <https://arxiv.org/abs/2506.04734>
- Unofficial audit of Diamond (models, not experts): <https://huggingface.co/datasets/adamallcock/gpqa-diamond-clean>
- MMLU-Pro paper <https://arxiv.org/abs/2406.01574> and dataset card <https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro>

Things I could not confirm are stated as such in the text above.
