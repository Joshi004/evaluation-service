# How GSM8K works in this service

This is a walkthrough of what happens when someone runs GSM8K here: where the questions come from, what the model is shown, which part of its reply is read, and how that becomes one percentage. It explains the ideas first and the file names second.

The trip a run takes (submit, start the model server, start the EvalScope container, collect the files) is the same for every benchmark and is explained in [How IFEval works in this service](IFEVAL_HOW_IT_WORKS.md). This page covers only what is specific to GSM8K. The other pages are [IFBench](IFBENCH_HOW_IT_WORKS.md), [GPQA-Diamond](GPQA_DIAMOND_HOW_IT_WORKS.md), [MMLU-Pro](MMLU_PRO_HOW_IT_WORKS.md) and the [overview](BENCHMARKS_OVERVIEW.md).

**The short version.** GSM8K is 1,319 school-level maths word problems. For each one, the model is shown four solved examples, then the new problem, and is told to reason step by step and put its final number inside `\boxed{}`. The service reads the number from the last `\boxed{}` in the reply and compares it with the number the dataset gives as the answer. Each question is right or wrong, nothing in between. The score is the share of questions that are right. The recipe is `catalog/standards/gsm8k-v1.yaml`. It has no reference score yet (it says "NOT YET RUN"), and `accuracy` is the only number it keeps.

All real outputs quoted here come from one run: `runs/run-7`, model `Qwen3-4B-allternary-ep03`, thinking on, one try per question. It got 1,203 of 1,319 right, which is 91.2%. It is the only GSM8K run in `runs/` that produced scores (two earlier attempts failed; see "Known gaps and surprises" below). Where I ran something myself instead of reading it from a file, I say so. Questions are named by their `index` in the run files: their position in the `test` split, counting from 0.

---

## What GSM8K is testing

GSM8K stands for "Grade School Math, 8K problems". Each question is a short story with numbers in it, for example:

> Natalia sold clips to 48 of her friends in April, and then she sold half as many clips in May. How many clips did Natalia sell altogether in April and May?

Solving it takes two small steps (48 / 2 = 24, then 48 + 24 = 72). The answer is **72**. Problems in the set take between 2 and 8 steps and use ordinary arithmetic.

**It tests** reading a short story problem, turning it into steps, doing each step's arithmetic correctly without losing track, and finishing on one number.

**It does not test**

- Hard maths. The dataset card says the problems need nothing "beyond the level of early Algebra".
- Facts, writing quality, or following format rules (that is closer to IFEval).
- Whether the reasoning is good. Only the final number is checked. A lucky guess gets full marks; perfect reasoning with a slip in the last addition gets zero.
- Tool use (the model has no calculator), or any language other than English.

**Who made it, and why.** A team at OpenAI (Cobbe and colleagues) released it in 2021 with the paper "Training Verifiers to Solve Math Word Problems". Their starting point was that even the largest models of the time were weak at multi-step maths, so they built a dataset to measure and study that. The paper's own method was to train a second model, a "verifier", to pick the best of many tries. The first thousand problems were written by freelancers hired through Upwork; Surge AI, a data-labelling company, then scaled up the rest. The stated bar is that "a bright middle school student should be able to solve every problem". The authors estimate that fewer than 2% of problems have errors that break them (a second check on a smaller sample found 1.7%), and warn that a larger share might have subtle errors.

---

## Where the questions live

**Original home.** OpenAI published the data with the paper: the GitHub repository [`openai/grade-school-math`](https://github.com/openai/grade-school-math) (archived: "code is provided as-is, no updates expected") and the Hugging Face dataset [`openai/gsm8k`](https://huggingface.co/datasets/openai/gsm8k). The licence is MIT.

**The copy this service uses.** The recipe names `AI-ModelScope/gsm8k`, a copy on ModelScope, the hub EvalScope loads from by default. Its `main` and `socratic` folders were last changed on 3 January 2025 ("Convert dataset to Parquet"), and its description is the Hugging Face card's. I could not prove it is identical to the original, but two things point that way. It has 1,319 test questions, as the Hugging Face card says. And 1,209 of them match, word for word (ignoring extra spaces), questions in GSM8K-Platinum, a cleaned copy of the Hugging Face test set that dropped exactly 110 questions.

**Parts and splits.** The part (EvalScope says "subset") is `main`. The other part, `socratic`, adds helper sub-questions and is not used. The `test` split has **1,319 questions** and is what gets scored. (ModelScope's card calls this split "validation", but EvalScope loads it as `test` and finds 1,319 rows.) The `train` split has 7,473 problems. None are scored; only the first four are read, as worked examples.

**What one row holds.** Two text fields. `question` is the story problem. `answer` is a worked solution written by a person, with small calculator notes such as `<<48/2=24>>` and a last line `#### <number>`. The number after `####` is the official answer. This is the first row of the `train` split:

```
question: Natalia sold clips to 48 of her friends in April, and then she sold half as many
          clips in May. How many clips did Natalia sell altogether in April and May?
answer:   Natalia sold 48/2 = <<48/2=24>>24 clips in May.
          Natalia sold 48+24 = <<48+24=72>>72 clips altogether in April and May.
          #### 72
```

EvalScope cuts the `answer` at `####`. What follows becomes the official answer (the "target"). What comes before is kept as "reasoning". Of the 1,319 official answers in the `test` split, none has a decimal point, two are negative, and 14 are written with a thousands comma, such as `2,125`.

**How the data reaches the container.** It is not downloaded during a run. When the EvalScope image is built, `harness/evalscope/prefetch_dataset.py` loads all five benchmark datasets once, through the same code a real run uses (including GSM8K's `train` split), and leaves them in a cache inside the image. A run reads that cache. The recipe has no dataset version (`dataset_revision` is empty, and the recipe says EvalScope has no setting for one), so the image tag is the only pin: the data is whatever ModelScope served when the image was built. Run-7's log fits this: the dataset was ready a second after the run started, with no download. Two caveats: the script's own notes say the full check (build the image, then run with the network off) was still to be done when it was written, and I could not find which image tag run-7 used.

**Where results are kept.** Inside `runs/run-7/`, same layout as for IFEval:

| File | What it holds |
|---|---|
| `harness_task_config.json` | The instruction sheet given to EvalScope |
| `predictions/<model>/gsm8k_main.jsonl` | One line per question: the full reply (thinking and final text as separate parts), token counts, why it stopped |
| `reviews/<model>/gsm8k_main.jsonl` | One line per question: the message sent, the reply, the official answer, the number read from the reply, and the 1.0 or 0.0 score |
| `reports/<model>/gsm8k.json` | The totals: one `accuracy` entry, score 0.9121 over 1,319 questions |
| `diagnostics/<model>/gsm8k.json` | The service's own summary for the drill-down page, built after the run |

From the code, the service also keeps the whole report (`results_json`), one row for the headline metric, and the `truncation_rate` in its database. I did not look inside the database.

---

## The four worked examples

Before the real question, the model is shown four problems that are already solved, each with its steps and final answer. The technical name is "few-shot prompting" (here "4-shot"). The plain meaning: show before you ask. Asking with no examples is "0-shot", or asking cold.

**Where the four come from.** They are the first four rows of the `train` split, in order. They are not random, and the same four are used for all 1,319 questions. I checked that every message in run-7 starts with the identical examples text. (EvalScope has a switch for random picks, `few_shot_random`; it is off.) The four are the Natalia clips, Weng babysitting, Betty wallet and Julie reading problems. Each is written as the question, then "Reasoning:" with the dataset's own worked solution, then `ANSWER: \boxed{<number>}`.

**The exact message the model receives.** One chat message from the "user", no system message. This is the full text for question `index` 1, copied from `runs/run-7/reviews/Qwen3-4B-allternary-ep03/gsm8k_main.jsonl`:

```
Here are some examples of how to solve similar problems:

Natalia sold clips to 48 of her friends in April, and then she sold half as many clips in May. How many clips did Natalia sell altogether in April and May?

Reasoning:
Natalia sold 48/2 = <<48/2=24>>24 clips in May.
Natalia sold 48+24 = <<48+24=72>>72 clips altogether in April and May.

ANSWER: \boxed{72}

Weng earns $12 an hour for babysitting. Yesterday, she just did 50 minutes of babysitting. How much did she earn?

Reasoning:
Weng earns 12/60 = $<<12/60=0.2>>0.2 per minute.
Working 50 minutes, she earned 0.2 x 50 = $<<0.2*50=10>>10.

ANSWER: \boxed{10}

Betty is saving money for a new wallet which costs $100. Betty has only half of the money she needs. Her parents decided to give her $15 for that purpose, and her grandparents twice as much as her parents. How much more money does Betty need to buy the wallet?

Reasoning:
In the beginning, Betty has only 100 / 2 = $<<100/2=50>>50.
Betty's grandparents gave her 15 * 2 = $<<15*2=30>>30.
This means, Betty needs 100 - 50 - 30 - 15 = $<<100-50-30-15=5>>5 more.

ANSWER: \boxed{5}

Julie is reading a 120-page book. Yesterday, she was able to read 12 pages and today, she read twice as many pages as yesterday. If she wants to read half of the remaining pages tomorrow, how many pages should she read?

Reasoning:
Maila read 12 x 2 = <<12*2=24>>24 pages today.
So she was able to read a total of 12 + 24 = <<12+24=36>>36 pages since yesterday.
There are 120 - 36 = <<120-36=84>>84 pages left to be read.
Since she wants to read half of the remaining pages tomorrow, then she should read 84/2 = <<84/2=42>>42 pages.

ANSWER: \boxed{42}

A robe takes 2 bolts of blue fiber and half that much white fiber.  How many bolts in total does it take?
Please reason step by step, and put your final answer within \boxed{}.
```

Things to notice:

- The real question comes last, with no label. Only those last two lines change between questions.
- The calculator notes (`<<48/2=24>>`) are left in the examples. The fourth example says "Maila" in the solution but "Julie" in the question; that slip is in the original data.
- The message is about 661 tokens on average (smallest 623, largest 788), nearly all of it the four examples. A token is a small chunk of text, roughly three-quarters of a word.
- In the recipe the instruction is written `\boxed{{}}` with doubled braces, because the template goes through Python's `.format()`. The model sees `\boxed{}`.

**Why examples change the score.** Two reasons. First, format: the examples show exactly where the final number goes, in a box at the end, so it is easier to find. Second, habit: they show the model working through steps before giving a number. In the chain-of-thought paper (Wei and colleagues, 2022) one very large model (PaLM 540B) scored 17.9% on GSM8K when its examples showed only answers, and 56.9% when they showed the steps.

How much this matters for the models tested here, I could not confirm. That study used an old model. Modern chat models usually reason step by step without being shown how, and the instruction line already asks for it. I found no source that measures the gap for them, and this service has no cold GSM8K run to compare with. From reading the code (I did not run it), overriding `few_shot` to 0 makes EvalScope skip the examples and send only the question and the instruction line. That would be a different standard (a new hash), so its score would sit apart from the 4-shot one. The choice of examples matters too: the same paper found that different sets of worked examples gave different scores on a smaller model, although every set beat the answers-only baseline by a wide margin. So the result is "GSM8K with these four examples", not "GSM8K in general".

---

## Three real questions

All three are from run-7. In each, the model was sent the same four worked examples, then the question, then the instruction line (the full message for `index` 1 is shown above). The model's thinking is not shown. Long text is trimmed with "..." and I say where.

### Example 1: a plain success (`index` 1)

**The dataset row** (`test` split):

```
question: A robe takes 2 bolts of blue fiber and half that much white fiber.  How many bolts in total does it take?
answer:   It takes 2/2=<<2/2=1>>1 bolt of white fiber
          So the total amount of fabric is 2+1=<<2+1=3>>3 bolts of fabric
          #### 3
```

**What the model answered.** The server delivers the reply in two parts. The thinking part (768 characters) is not scored. The final reply, complete:

```
The robe requires 2 bolts of blue fiber. Since it requires half as much white fiber as blue fiber, the amount of white fiber needed is:

$$
\frac{2}{2} = 1 \text{ bolt}
$$

Adding the blue and white fibers together gives the total number of bolts:

$$
2 + 1 = 3
$$

**Answer:** \boxed{3}
```

**How it was graded.** The last `\boxed{...}` holds `3`. The official answer is `3`. They are equal, so the question scores 1.0. The words around the box and the `**Answer:**` label are ignored.

### Example 2: the model is right, the dataset is wrong (`index` 1309)

**The dataset row:**

```
question: The girls are trying to raise money for a carnival. Kim raises $320 more than
          Alexandra, who raises $430, and Maryam raises $400 more than Sarah, who raises $300.
          How much money, in dollars, did they all raise in total?
answer:   Kim raises 320+430=<<320+430=750>>750 dollars.
          Maryam raises 400+300=<<400+300=700>>700 dollars.
          They raise 750+430+400+700=<<750+430+400+700=2280>>2280 dollars.
          #### 2280
```

**What the model answered.** The thinking part is 2,737 characters. The final reply, trimmed where marked:

```
### Step 1: Determine the amount raised by each girl

- **Alexandra** raised **$430**.
- **Kim** raised **$320 more** than Alexandra:
  $$
  \text{Kim} = 430 + 320 = 750
  $$
- **Sarah** raised **$300**.
...
- $ 430 + 750 = 1180 $
- $ 1180 + 700 = 1880 $
- $ 1880 + 300 = 2180 $

---

### Final Answer:

$$
\boxed{2180}
$$
```

**How it was graded.** The last box holds `2180`. The official answer is `2280`. They are not equal, so the question scores 0.0.

**Why this is the dataset's fault.** The dataset's own solution adds `750+430+400+700`. The `400` is how much more Maryam raised than Sarah, not money anyone raised. Sarah's `300` belongs there: 750 + 430 + 300 + 700 = 2,180. The model's total is right. The GSM8K-Platinum team re-checked the test set and changed this answer to 2180 (I confirmed that by comparing the files). This service uses the original, so a correct reply is marked wrong.

### Example 3: right idea, wrong writing for the grader (`index` 1001)

**The dataset row** (question in full, solution trimmed):

```
question: Jordan wanted to surprise her mom with a homemade birthday cake.  From reading the
          instructions, she knew it would take 20 minutes to make the cake batter and 30
          minutes to bake the cake.  The cake would require 2 hours to cool and an additional
          10 minutes to frost the cake.  If she plans to make the cake all on the same day,
          what is the latest time of day that Jordan can start making the cake to be ready to
          serve it at 5:00 pm?
answer:   1 hour is 60 minutes so we know that 2 hours to cool the cake is the same as 2*60 so <<2*60=120>>120 min
          ...
          If the cake needs to be finished by 5:00 pm and it will take 3 hours total to make then
          5-3 = <<5-3=2>>2:00 pm is the latest she can start making the cake
          #### 2
```

**What the model answered.** The thinking part is 5,874 characters. The end of the final reply:

```
### Step 3: Determine the latest start time

If Jordan needs the cake ready by **5:00 pm**, and the process takes **3 hours**, then she must start no later than:

$$
5:00 \, \text{pm} - 3 \, \text{hours} = 2:00 \, \text{pm}
$$

---

### Final Answer:

$$
\boxed{2:00}
$$
```

**How it was graded.** The last box holds `2:00`. The official answer is `2`. As text they differ, and `2:00` is not a number the grader can read, so the question scores 0.0.

**Why.** The model's reasoning is right: start at 2:00 pm. But the official answer is the bare hour, and the grader does not know `2:00` means `2`. GSM8K-Platinum's authors left this question out of their cleaned test set.

---

## What the model has to produce

Two things: show its reasoning, then finish with the final number in `\boxed{}`.

**What is read.** Only the final reply text, and inside it only the content of the last `\boxed{...}`. Everything else is ignored: the steps, the explanation, units written outside the box, and any earlier boxes.

**If there is no box.** EvalScope falls back, in this order: the text after the last "the answer is", then after the last "final answer is", then after the last `ANSWER:`, and last of all the last number anywhere in the reply. That last step is a risky guess: in my test, "The total cost is 18 dollars for 3 items." was read as `3`. In run-7 the fallback was never needed: all 1,311 replies that finished had a box.

**Wrong format.** Extra words inside the box break the match: `\boxed{18 dollars}` is read as `18dollars`. A unit wrapped in `\text{...}` is fine. A time like `2:00` fails against `2`. This was rare in run-7: of 1,311 boxed answers, only 4 were not plain numbers. One was `2:00` (Example 3). The other three were fractions (`20/3`, `350/9`, `8/3`) where the official answers are whole numbers (5, 7000, 2), so those are wrong answers, not wrong writing.

**Running out of tokens.** Each reply may use up to 16,384 tokens, thinking included. If the thinking uses them all, the reply stops mid-thought and the final text is empty. There is nothing to read, so the question scores 0. In run-7 this happened to 8 of 1,319 questions (0.6%), each taking about five minutes. In `index` 427 the thinking ran to 49,845 characters and ended in a loop. This is the end of it:

```
... but this is not close.2.0. but this is not close.2.0. but this is not close.2.0. but this is
```

**Thinking first.** Models such as Qwen3 can think before they answer, and run-7 had thinking switched on for every request. The recipe says `think_handling: strip`, but that is a rule the service checks, not a step it performs. The check (`strip_needs_reasoning_parser`) reports an error if thinking is on and the model server has no "reasoning parser", the vLLM feature that moves the thinking into its own field. So the grader sees only the final reply. Run-7 shows this working: all 1,319 replies have a separate thinking part, and none of the graded texts contains a `<think>` tag.

---

## How the grading works, step by step

EvalScope does all seven steps and writes the report. The service then reads one number from it.

**1. The official answer.** The text after `####`, with outer spaces trimmed. Commas stay (`2,125`). Nothing before `####` is used for grading.

**2. The reply.** Only the final text, with the thinking already separate.

**3. Find the answer.** The last box first, then the fallbacks above.

**4. Tidy it.** Line breaks, a leading ":" and a trailing "." or "/" are dropped. Then these are removed or converted: `$` and `\$`, `%`, spaces, a `\text{...}` unit at the end, a leading `x =`, a final `.0` or `.00` (`72.0` becomes `72`), thousands commas (`2,125` becomes `2125`), and number words (`twelve` becomes `12`).

**5. Compare.** Both strings, tidied the same way, go to EvalScope's `math_equal` function. In plain terms:

- The same text, ignoring upper and lower case: right.
- Both are numbers: right if they agree within 0.01%. So `18.001` passes for 18 and `17.9` does not.
- Otherwise it tries to read both as maths expressions, so `\frac{7}{2}` equals `3.5`.
- An empty answer: wrong.

**6. Score the question.** 1.0 or 0.0. No partial credit.

**7. Average.** `accuracy` is the average over all scored questions. With one try each, that is right answers divided by questions: 1,203 / 1,319 = 0.9121. If `repeats` were above 1, every try would be scored on its own and the average would run over all of them (GPQA-Diamond works that way).

The service reads the metric `accuracy` (aggregation `mean`) from EvalScope's report, stores it with the question count, and keeps the whole report. The recipe lists `accuracy` as its only metric, so that is the only score kept.

The `numeric: true` option in the recipe is what switches EvalScope to the number-aware comparison in step 5. Without it, the two would be compared as plain text (trimmed and lower-cased), and `2125` would fail against the official `2,125`. That would hit 13 of run-7's right answers. The recipe's own comment gives `72.0` against `72` as the example, but step 4 already turns `72.0` into `72`, so I could not reproduce that one.

**What I tested.** I ran EvalScope's own answer-reading and comparing functions, from the exact commit the image uses, on replies I made up. This was done in a throwaway folder outside the repo. The results are real outputs, but the replies are my own strings, not run outputs. "Seen" marks cases that also occurred in run-7.

| Reply (what is in the box) | Official answer | Read as | Result |
|---|---|---|---|
| `\boxed{72.0}` | 72 | `72` | right (seen: `12.00`, `index` 873) |
| `\boxed{2125}` | `2,125` | `2125` | right (seen: 13 questions, such as `index` 146) |
| `\boxed{\$18}` or `\boxed{$18}` | 18 | `18` | right |
| `\boxed{18 \text{ dollars}}` | 18 | `18` | right |
| `\boxed{18 dollars}` | 18 | `18dollars` | wrong |
| `\boxed{25\%}` | 25 | `25` | right |
| `\boxed{\frac{7}{2}}` | 3.5 | `\frac{7}{2}` | right |
| `\boxed{18.001}` | 18 | `18.001` | right (within 0.01%) |
| `\boxed{36.36}` | 36 | `36.36` | wrong (seen: `index` 93) |
| `\boxed{2:00}` | 2 | `2:00` | wrong (seen: `index` 1001) |
| "The answer is 18." (no box) | 18 | `18` | right |
| "...18 dollars for 3 items." (no box) | 18 | `3` | wrong |
| `\boxed{0.25}` | 25 | `0.25` | **right** |
| `\boxed{2500}` | 25 | `2500` | **right** |

**A surprise in the last two rows.** `math_equal` has an option, `include_percentage`, that is on by default. It also accepts an answer that is the official answer divided or multiplied by 100. It is meant for percentages, but it applies to every question, so `0.25` and `2500` both pass for an official answer of `25`. I do not know whether this is intended. It did not matter in run-7: I checked all 1,203 right answers, and every one equals the official answer exactly (after removing commas). None passed through this rule.

---

## What is different about a GSM8K run

Everything in the [IFEval page](IFEVAL_HOW_IT_WORKS.md) about the general flow applies. The GSM8K-specific parts:

- **Examples first.** EvalScope loads the `test` split and the first four rows of `train`, and puts the four examples in front of every question.
- **One request per question.** `eval_batch_size: 32` means up to 32 requests in flight at once, not 32 questions in one message. Lines in the saved files are in the order replies came back, not by `index`.
- **Time limits.** Each request may take up to 1,800 seconds, and EvalScope retries a failed request up to 5 times, 10 seconds apart (shown in run-7's log). There is no limit on the whole run. Run-7 took about 19.5 minutes (log: 16:59:31 to 17:19:03). The average reply took 26 seconds, the middle one 17, the slowest 316.
- **Thinking and sampling.** Run-7's settings (temperature 0.6, top_p 0.95, top_k 20, up to 16,384 tokens, thinking on) match the sampling profile `qwen3_think`. Replies averaged 1,448 tokens (median 949), thinking included. The recipe has no sampling overrides; it says GSM8K's own definition "mandates nothing about sampling". The `greedy` profile (temperature 0, which always takes the most likely next word; thinking off; 8,192 tokens) is the one the recipe's missing reference score was meant to use.
- **Subsets and tries.** One subset (`main`) and one try. The recipe's reasoning is that with 1,319 questions the noise from sampling already averages out.

---

## How GSM8K compares with the other four benchmarks

| | GSM8K | IFEval | IFBench | GPQA-Diamond | MMLU-Pro |
|---|---|---|---|---|---|
| Questions | 1,319 | 541 | 300 | 198 | 12,032 |
| Worked examples | 4, from `train` | 0 | 0 | 0 | 5, from `validation` |
| What the model writes | steps, then a number in `\boxed{}` | a normal reply | a normal reply | steps, then `ANSWER: [LETTER]` | steps, then `ANSWER: [LETTER]` |
| How it is judged | a number is read out and compared | rule-checking code reads the whole reply | same as IFEval | a letter is read out and compared | a letter is read out and compared |
| Scores kept | 1 | 4 | 4 | 1 | 1 |
| Tries per question | 1 | 1 | 1 | 4 | 1 |

- **Like all five:** one chat request per question, thinking handled by the model server, and no pinned dataset version (`dataset_revision` is empty in every recipe).
- **Unlike IFEval and IFBench:** they send the prompt as it is and check rules against the whole reply, so there is no answer to find. GSM8K needs the answer-finding step, and it is the only recipe with an option that changes how answers are compared (`numeric`).
- **Unlike GPQA-Diamond:** GPQA-Diamond has only 198 questions, so each is asked four times. GSM8K has 1,319 and is asked once.
- **Like MMLU-Pro:** both take their worked examples from the data. MMLU-Pro's recipe says its 12,032 ten-option questions have short answers that leave the GPU idle at batch size 32, hence 128. A comment in the GSM8K recipe says GSM8K is the only newer recipe with examples from data. That is no longer true.

---

## Things worth knowing

### Is 91.2% good?

I can only answer with outside numbers, and none is like for like.

- The Qwen team reports 87.79% on GSM8K for `Qwen3-4B-Base`, a base model, using 4 examples with reasoning and their own set-up (Table 7 of the Qwen3 technical report, May 2025). Run-7 tested a different checkpoint, `Qwen3-4B-allternary-ep03`, and I could not confirm how it was made.
- The GSM8K-Platinum authors (March 2025) report that on the original test set Claude 3.7 Sonnet (extended thinking) and Llama 405B each made 45 errors, about 96.6% right (my arithmetic). On their cleaned test set of 1,209 questions the same two made 2 and 17 errors.

So 91.2% is above that base model's published figure and below those two large models. On the cleaned set, run-7's replies would make 67 errors (94.5%, my calculation, explained below), against 17 for Llama 405B. But the set-ups differ (thinking on, sampled, chat template), and this service has no other scored GSM8K run or reference score to compare with.

### How jumpy is the number?

- With 1,319 questions, one question is worth 0.076 points.
- The service works out a 95% interval from the score and the question count (`wilson_interval` in `report_summary.py`). For run-7 it is 89.6% to 92.6%, about plus or minus 1.5 points. It says how far the score could be from the model's true ability on problems like these, given only 1,319 questions.
- Run-7 also sampled at temperature 0.6 with no per-request seed (see below), so a re-run would change some answers. Nobody has repeated GSM8K here, so I cannot say by how much. The same questions are reused, so I would expect the change to be smaller than the interval, but that is my reasoning, not a measurement.
- A gap of one or two points between two models is inside that range. Treat it as a hint, not a finding.

### Wrong answers that are not the model's fault

- The GSM8K authors estimated under 2% bad questions. A later check found more. The GSM8K-Platinum team ran frontier models on the test set and checked by hand the 219 questions where any model disagreed with the label. They removed 110 (most often because the question was ambiguous or contradicted itself), kept 99 as they were, and corrected the answer of 10. That is about 9% of the 1,319 removed or corrected.
- I compared run-7 with that set, matching questions by their text (in a scratch folder; nothing saved in the repo):
  - 44 of run-7's 116 wrong answers are on the 110 removed questions. On those 110 the model got 66 right (60%). On the other 1,209 it got 1,137 right (94.0%).
  - Of the 10 corrected answers, in 7 the model's answer equals the corrected one but was marked wrong (for example `index` 1309 above). In 2 the model's answer matched the old, wrong label, so it got credit it would not get today (`index` 288 and 1035). In the tenth it was wrong under both labels.
  - On the 1,209 kept questions, with the corrected answers, the same replies would score 1,142 of 1,209, which is 94.5%. That is my own calculation, not a Platinum number. About three points of the gap between 91.2% and 94.5% come from questions and labels the Platinum team found faulty.
- Another example is `index` 93: "Gerald changed his diet, which improved his speed by 10%". The dataset takes 10% off his time (40 to 36 seconds). The model's 36.36 is 40 divided by 1.1, a 10% faster speed. Either reading is defensible. Platinum removed this question too.

### Solved, and leaked

- **Mostly solved at the top.** The Platinum authors say frontier models had plateaued around 95% on the original test set, and on their cleaned set one of them made just 2 errors in 1,209 (March 2025). The GSM1k paper says "top models report benchmark accuracies of over 95%" as of June 2024. A third-party leaderboard (BenchLeader, 2 October 2026, copying Epoch AI data) calls GSM8K "saturated" and says it "separates only older or smaller models". I found no primary source newer than March 2025, so for later models I could not confirm it. For a small model like run-7's, 91% still leaves room.
- **Leaked questions.** The test questions are public. The GSM1k paper (Scale AI, 2024) wrote 1,205 fresh problems in the same style. Some model families scored up to 8% lower on them, which the authors read as partial memorising of GSM8K. Frontier models showed little sign of it. I know nothing about the training data of the checkpoints tested here.

### Thinking mode

- Thinking makes replies longer and slower, and it can fail by never finishing. A comment in the `qwen3_think` profile says a 512-token budget produced 512 tokens of thinking and no answer at all on "this exact checkpoint" (it does not say which).
- The drill-down summary for run-7 says: "8 failing answers came back empty — usually a request error rather than a model failure." That is misleading here. No request failed (`errored_requests` is 0). The 8 empty answers are the same 8 that hit the token limit. The same summary calls them "a mechanical failure, not a model one", which is arguable for a model that loops in its thinking.

### Why other teams' GSM8K numbers cannot be compared

`docs/BENCHMARK_UNIFICATION_RESEARCH.md` says the low-bit team (repository `qvac-research-one-bit-models`) runs its benchmarks through lm-evaluation-harness with mostly exact-match grading, plus a local script that cuts out `<think>...</think>` before re-grading. This service uses EvalScope. An older research note (in git history) lists GSM8K as run by two teams with these two tools and answers "No" to "Same measurement?". It does not say which lm-evaluation-harness variant is used. For the default `gsm8k` task, read from its own files, the differences are:

| | This service (EvalScope) | lm-evaluation-harness `gsm8k` |
|---|---|---|
| Worked examples | 4, from `train` | 5, from `train` |
| Answer expected | a number in `\boxed{}` | `#### <number>` at the end, as in the dataset |
| Reading the answer | last box, with fallbacks | two scores: "strict" needs the `#### number` pattern, "flexible" takes the last number |
| Comparing | number match within 0.01% | exact match after removing commas, `$` and a final "." |
| Decoding | whatever the sampling profile says | greedy |

The same tool also has `gsm8k_cot` (8 examples from the chain-of-thought paper, answers ending "The answer is N"). The older plan calls "5- or 8-shot chain-of-thought with `#### <number>` extraction" the classic convention from the original paper and lm-evaluation-harness. That is partly right: the `####` pattern comes from the original paper's code, and 5-shot is the tool's default. But the original paper trained models rather than giving examples, and the 8-shot set comes from the chain-of-thought paper. Qwen's technical report uses 4-shot for GSM8K (for its base models), like this service.

### Known gaps and surprises in this service

- **No reference score, one scored run.** The recipe says the reference score under the greedy profile is "NOT YET RUN". Run-7 used the sampled thinking profile.
- **Two failed attempts.** Runs 3 and 5 (model `Qwen3.5-0.8B-Think-MOPD-mixv2-RL-v11c-s810`) also ran GSM8K. In both, every request failed with "Connection error" after retries (run 3 spent 1 hour 41 minutes on this, run 5 about 35 minutes). EvalScope wrote an empty report and still logged "Finished evaluation". I did not check what the service showed for them; I have no database access.
- **Failed requests are dropped, not counted wrong.** The run is set to ignore errors (`ignore_errors: true`). If only some requests fail, those questions leave the average and the question count in the report drops below 1,319. Run-7 had none.
- **No per-request seed in run-7.** The code that sends the seed with every request was added on 28 September 2026. Run-7 ran on 11 September, and its saved config has `seed: 42` only at the top level, which never reaches the model. So run-7 cannot be repeated exactly.
- **Two recipe fields describe; they do not act.** `think_handling: strip` is a check, and `extraction: boxed` is a label that is part of the recipe's identity. Neither is sent to EvalScope, which always tries the box first and then the fallbacks listed above.
- **`prompt_template` is unused in a 4-shot run.** With examples, the message is built from `few_shot_prompt_template`. A run request can override `few_shot` and `prompt_template`, but not `train_split`, `few_shot_prompt_template` or `subsets`. So overriding `prompt_template` alone changes nothing unless `few_shot` is also set to 0.
- **`docs/TaskList.md`.** Item 1 (the thinking switch is not passed) and item 2 (the split is not sent) do not match the code today. `task_config.py` sends `enable_thinking` whether true or false, and run-7's saved config has `true`. It also sends `eval_split` and `train_split`, and run-7's config has `test` and `train`. Items 3 and 4 are about IFEval diagnostics and editing profiles, not GSM8K.
- **Thin drill-down and stale files.** The drill-down page lists each GSM8K question with the dataset's worked solution as extra detail, but has none of the rule-level analysis IFEval has. `runs/run-7/` also holds IFEval files from an earlier run (`ifeval_default.jsonl`, `ifeval.json`), and the end of its log lists IFEval scores next to GSM8K. They are not part of this run.

---

## Where to look in this repo

| File | What it does |
|---|---|
| `catalog/standards/gsm8k-v1.yaml` | The recipe: dataset, examples, templates, metric, token and time limits |
| `backend/app/services/harness/task_config.py` | Turns recipe plus sampling profile into the JSON given to EvalScope |
| `harness/evalscope/run_eval.py`, `prefetch_dataset.py` | Run EvalScope in the container; put the datasets into the image at build time |
| `backend/app/services/harness/parser.py` | Reads the report and works out `truncation_rate` |
| `backend/app/services/compatibility/rules.py` | Checks thinking against the reasoning parser, and the token budget |
| `backend/app/services/diagnostics/registry.py`, `report_summary.py` | The GSM8K entry for the drill-down page, and the 95% interval |
| `catalog/sampling-profiles/qwen3_think.yaml`, `catalog/serving-profiles/qwen3.yaml` | The sampling settings that match run-7, and the reasoning-parser setting |
| EvalScope (in the image) `benchmarks/gsm8k/gsm8k_adapter.py` | Splits the answer at `####`, builds the examples, reads the box |
| EvalScope (in the image) `metrics/math/parser.py`, `metrics/nlp/metrics.py` | The tidy-up and the `math_equal` comparison |

---

## Sources

Read outside the repo. EvalScope files are from commit `2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85`, the one the image is built from.

- GSM8K paper: https://arxiv.org/abs/2110.14168 (text read at https://ar5iv.labs.arxiv.org/html/2110.14168)
- Hugging Face dataset card: https://huggingface.co/datasets/openai/gsm8k
- Official repository: https://github.com/openai/grade-school-math (its `README.md` and `grade_school_math/dataset.py`, read as raw files)
- ModelScope copy (record and file list): https://www.modelscope.cn/api/v1/datasets/AI-ModelScope/gsm8k and https://www.modelscope.cn/api/v1/datasets/AI-ModelScope/gsm8k/repo/tree?Revision=master&Root=
- EvalScope source: https://github.com/modelscope/evalscope/tree/2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85/evalscope (`benchmarks/gsm8k/gsm8k_adapter.py`, `metrics/math/parser.py`, `metrics/nlp/metrics.py`, `metrics/utils/functions.py`, `api/benchmark/adapters/default_data_adapter.py`, `evaluator/evaluator.py`), and the docs page https://evalscope.readthedocs.io/en/latest/benchmarks/gsm8k.html
- GSM8K-Platinum: blog https://gradientscience.org/gsm8k-platinum/, dataset https://huggingface.co/datasets/madrylab/gsm8k-platinum (its `main/test-00000-of-00001.parquet` file was used for the comparison with run-7)
- Other papers: GSM1k https://arxiv.org/abs/2405.00332, chain-of-thought prompting https://arxiv.org/abs/2201.11903, Qwen3 technical report https://arxiv.org/abs/2505.09388
- lm-evaluation-harness GSM8K task files: https://github.com/EleutherAI/lm-evaluation-harness/tree/main/lm_eval/tasks/gsm8k
- BenchLeader GSM8K page (secondary source, copies Epoch AI data): https://www.benchleader.com/benchmarks/gsm8k

Inside the repo I also read old planning notes recovered from git history (`docs/EVAL_SERVICE_PLAN.md` and `docs/STANDARDS_AND_PROFILES_RESEARCH.md`, via `git show HEAD:...`).
