# The benchmarks this service supports

This page is a short map of the five benchmarks the evaluation service can run today. For each one it says what the benchmark tests, where the questions live, what a question looks like, and how an answer turns into a score. Every benchmark also has a longer "how it works" page, linked at the end of its section. Last checked: October 2026.

Two words are used all the way through:

- **Benchmark.** A fixed set of questions plus a fixed way of scoring the answers, so different models can take the same test.
- **Standard.** Our name for the written-down recipe for running one benchmark here. It is one YAML file in `catalog/standards/`. It fixes the dataset, how many solved examples to show first, the prompt wording, and which scores to keep. It does not fix the sampling settings (temperature, thinking on or off, answer length limit). Those come from a separate sampling profile that is chosen when a run is submitted.

Where the facts come from: facts about this service come from the recipes, checked against `backend/app/services/harness/task_config.py`, `backend/app/services/harness/parser.py` and the saved outputs in the local `runs/` folder. `runs/` is not in git, so ids such as `run-15` only exist on the machine where this page was written. Facts about the original benchmarks (who made them, why, how big) come from their papers and dataset cards, linked at the bottom. Where I could not confirm something, the page says so.

---

## At a glance

| Benchmark | What it tests | Questions | Solved examples shown first | Data (dataset id, split) | Answer the model gives | Headline score |
|---|---|---|---|---|---|---|
| IFEval | Following rules about a reply's form | 541 | none | `opencompass/ifeval`, `train` | Free text that obeys the rules | `prompt_level_strict` |
| IFBench | Following new, unusual rules | 300 | none | `allenai/IFBench_test`, `train` | Free text that obeys the rules | `prompt_level_strict` |
| GSM8K | Multi-step grade-school math | 1,319 | 4 | `AI-ModelScope/gsm8k` (`main`), `test`; examples from `train` | A number, written as `\boxed{...}` | `accuracy` |
| GPQA-Diamond | Very hard science questions | 198, each asked 4 times | none | `AI-ModelScope/gpqa_diamond`, `train` | One letter, A to D | `accuracy` |
| MMLU-Pro | Broad knowledge and reasoning | 12,032 | 5 | `TIGER-Lab/MMLU-Pro`, `test`; examples from `validation` | One letter, A to J | `accuracy` |

Notes on the table:

- **Solved examples** are also called "few-shot" examples: the model is shown a few solved questions before the real one. "None" is called 0-shot.
- **Questions** is the full benchmark. Every recipe has `sample_limit: null`, which means no cap. A quick test run can set a cap, and a score from a capped run is not the benchmark's score.
- **Headline score** is the metric marked primary in the recipe. `prompt_level_strict` is the share of prompts where every rule was followed. `accuracy` is the share of answers that were right.
- **Where the data is.** Not in git. Each dataset is copied into the harness Docker image when the image is built (`harness/evalscope/prefetch_dataset.py`), so a run should not need the internet and every run sees the same questions. One gap: the script's own comments say the finished image has not yet been tested with the network switched off. The image tag (`evalscope:2ce95c3-tier1`) is what pins the data version, because none of the recipes name a dataset revision.

**Is this the full list?** Yes. I checked the recipe folder and every place in the code that could name a benchmark. The dataset download script for the harness image and the score drill-down registry (`backend/app/services/diagnostics/registry.py`) name exactly these five. The compatibility rules and the frontend benchmark-name component have no benchmark list of their own. Other benchmark names show up only in comments: BFCL, ACEBench, tau2/tau3 and ToolSandbox in the `qwen3-tools` serving profile (as benchmarks that will need it), and AIME25 and MATH-500 in code comments (as examples of benchmarks that would need their own sampling settings). None has a recipe, so none can be run today.

---

## IFEval

**What it tests.** Whether the model obeys mechanical rules written into an ordinary request, such as "do not use any commas" or "write at least 300 words". It does not test whether the answer is true, clever or well written.

**Who made it, and why.** Google researchers (paper "Instruction-Following Evaluation for Large Language Models", 2023). Human graders are slow and hard to repeat, and a judge model can be biased, so they chose rules that plain code can check.

**Where the data lives.** ModelScope dataset `opencompass/ifeval`, which the IFEval deep-dive page calls a copy of Google's set (`google/IFEval` on Hugging Face). It has one split, named `train`, with 541 prompts. The two prompts I compared against the Hugging Face card match word for word. Each prompt carries one to three rules: 305 prompts have one, 179 have two and 57 have three (counted from a saved run), drawn from 25 kinds of rule.

**What a question looks like.** The model sees only the prompt text, with no wrapper and no solved examples:

> I am planning a trip to Japan, and I would like thee to write an itinerary for my journey in a Shakespearean style. You are not allowed to use any commas in your response.

The rule list stored with this prompt (the model never sees it) has one entry: `punctuation:no_comma`.

**What the model must answer.** Free text, any length, that obeys the rules.

**How it is graded.** By code, not by another model. A small checker per rule says pass or fail. "Strict" checks the reply as written. "Loose" also tries a few light clean-ups (dropping the first or last line, stripping asterisks).

**What the headline number means.** `prompt_level_strict`: of the 541 prompts, the share where every rule passed under the strict check. A prompt with three rules fails if even one is broken, so there is no partial credit. Three other scores are kept too; the IFEval deep-dive page explains them.

**Watch out.** A pass means the rules were kept, nothing more. In `run-15` the reply to the prompt above was a few lines of capital letters starting "HARK IT IS TIME TO PART OF THE TRIP IN THE JAPANESE LANDING". It is a poor itinerary, but it has no comma, so it passes.

Deep dive: [IFEval](IFEVAL_HOW_IT_WORKS.md)

---

## IFBench

**What it tests.** The same skill as IFEval, following checkable rules about the form of a reply, but with 58 newer rules that IFEval does not have. It does not test knowledge or writing quality either.

**Who made it, and why.** Ai2 (the Allen Institute for AI) and the University of Washington (paper "Generalizing Verifiable Instruction Following", 2025). They found that many models are tuned on the small set of rules IFEval uses and then fail on rules they have not seen. IFBench is a test made of unseen rules.

**Where the data lives.** `allenai/IFBench_test`, one split named `train`, 300 prompts. Each is an ordinary user-style request with one or two rules added: 256 prompts have one rule and 44 have two (counted from a saved run). The paper says the requests come from WildChat, were held out from public release, and were checked by people to make sure each request fits its rule. The prompt shown below (key 21) matches the Hugging Face card word for word. The paper also describes a multi-turn version; this service runs only the 300 single-turn prompts.

**What a question looks like.** One user message, no solved examples:

> Include exactly 5 numbers in the response. For a generative AI system, suppose a generated output is substantially similar to an item in the training dataset. Does this prove that the training dataset item was memorized?

The rule is `count:numbers` with N = 5. In `run-16` the model's whole reply was `1 2 3 4 5`. That has exactly five numbers, so it passes.

**What the model must answer.** Free text that obeys the rules.

**How it is graded.** Like IFEval: code checkers with no judge model, a strict and a loose version, and prompt-level and instruction-level scores.

**What the headline number means.** `prompt_level_strict`: the share of the 300 prompts where every rule passed under the strict check. Same meaning as in IFEval, but on a different and harder set of rules.

**Watch out.** It is harder than IFEval by design. In saved runs, one model with the same settings scored 85.0% on IFEval (`run-15`) and 47.0% on IFBench (`run-16`). Do not read an IFBench score against an IFEval score.

Deep dive: [IFBench](IFBENCH_HOW_IT_WORKS.md)

---

## GSM8K

**What it tests.** Multi-step arithmetic in short word problems (the name stands for "Grade School Math"). Each problem takes two to eight simple steps, and the authors say a bright middle-school student could solve every one. It does not test broad knowledge or advanced math.

**Who made it, and why.** OpenAI researchers (paper "Training Verifiers to Solve Math Word Problems", 2021). Models of the time struggled with multi-step math, so the authors had freelance writers (hired through Upwork and Surge AI) write about 8,500 problems, both to study that weakness and to test a method that trains a checker to pick the best of many tries.

**Where the data lives.** `AI-ModelScope/gsm8k`, configuration `main`, split `test`: 1,319 problems. The solved examples come from the `train` split (7,473 problems, a count taken from the Hugging Face card). The test count and the first training problems match that card (`openai/gsm8k`).

**What a question looks like.** The model is shown four solved problems first, then the real one. The four are always the same: the first four problems of the `train` split, each with its worked solution (all 1,319 prompts in `run-7` open with identical text). The real question, as sent:

```
A robe takes 2 bolts of blue fiber and half that much white fiber.  How many bolts in total does it take?
Please reason step by step, and put your final answer within \boxed{}.
```

The correct answer is 3.

**What the model must answer.** Work through the problem, then give the final number as `\boxed{3}`. In `run-7` the model reasoned in a few lines and ended with `**Answer:** \boxed{3}`.

**How it is graded.** By code. The grader takes the content of the last `\boxed{...}` in the reply. If there is none, it falls back to the text after "The answer is" or "ANSWER:", and then to the last number in the reply. It compares that with the correct number as a number, so `3` and `3.0` match. No judge model.

**What the headline number means.** `accuracy`: the share of the 1,319 problems with the right final number. Only the final number counts, not the reasoning.

**Watch out.** Modern models score high, so the top of the range is crowded: one checkpoint (`Qwen3-4B-allternary-ep03`) scored 91.2% in `run-7`. A 2024 study (GSM1k, from Scale AI) wrote a fresh look-alike set and found that some model families scored up to 8 points lower on it, which suggests partial memorization of GSM8K. A high score here shows less than it used to.

Deep dive: [GSM8K](GSM8K_HOW_IT_WORKS.md)

---

## GPQA-Diamond

**What it tests.** Very hard science questions (biology, physics, chemistry) with four options, written so that a web search does not give the answer. Guessing gets 25%.

**Who made it, and why.** David Rein and colleagues at New York University, with Cohere and Anthropic (paper "GPQA: A Graduate-Level Google-Proof Q&A Benchmark", 2023). They wanted test questions for research on supervising AI that knows more than its supervisors, so the questions had to be hard even for skilled people to check. Questions were written and checked by people with or working toward PhDs. On the paper's main 448-question set, experts reached 65% and skilled non-experts with web access reached 34%. "Diamond" is the best-quality subset: 198 questions where both expert checkers agreed with the answer and most non-experts got it wrong.

**Where the data lives.** `AI-ModelScope/gpqa_diamond`, one split named `train` (the only one available), 198 questions. The count matches the paper. I did not compare contents, because the authors ask that questions not be shared.

**What a question looks like.** The authors ask people not to show real questions in plain text online, so this page does not copy one. Below is a **made-up example, not a real GPQA question**, in the same shape (real ones are much longer and much harder). The model sees one user message: the question, four options, and an instruction to think step by step and end with `ANSWER: [LETTER]`. No solved examples. The order of the options is shuffled, but the shuffle comes from the question's text, so every run sees the same order.

```
MADE-UP EXAMPLE (not from GPQA)
A pea plant with genotype AB/ab (the dominant alleles A and B sit together on one chromosome)
is crossed with an ab/ab plant. The two genes are 10 map units apart, so 10% of the offspring
are recombinants. What fraction of the offspring have genotype Ab/ab?
A) 10%
B) 45%
C) 5%
D) 25%
```

The correct answer here is C: the 10% of recombinant offspring split evenly between Ab/ab and aB/ab, so each is 5%.

**What the model must answer.** One letter, A to D, on a last line such as `ANSWER: C`.

**How it is graded.** By code. The grader reads the letter after `ANSWER:` and compares it with the correct letter. With no `ANSWER:` line it falls back to the last capital letter in the reply, if that is a valid option, and otherwise counts no answer, which scores wrong. Each question is asked 4 times, so a run grades 792 answers (EvalScope's log says "792 samples to evaluate").

**What the headline number means.** `accuracy`: the average share of correct letters over those 792 answers.

**Watch out.** With only 198 questions, one question moves the score by half a point and the 95% margin of error is about 7 points. Asking four times calms the model's own randomness but does not shrink that margin, because the questions are the same. Also, the only saved GPQA-Diamond run (`run-6`) stopped partway, at 290 of 792 answers, and wrote no report. 79 of those 290 answers hit the 16,384-token limit.

Deep dive: [GPQA-Diamond](GPQA_DIAMOND_HOW_IT_WORKS.md)

---

## MMLU-Pro

**What it tests.** Broad knowledge plus reasoning across 14 subjects (math, physics, chemistry, law, engineering, economics, health, psychology, business, biology, philosophy, computer science, history and "other"), as ten-option multiple choice. It is a harder, harder-to-guess successor of MMLU, a widely used knowledge test.

**Who made it, and why.** Yubo Wang and colleagues, mostly at the University of Waterloo, with the University of Toronto and Carnegie Mellon (paper "MMLU-Pro: A More Robust and Challenging Multi-Task Language Understanding Benchmark", 2024; the dataset is published under the name TIGER-Lab). Scores on MMLU had leveled off, so models were hard to tell apart. They dropped trivial and noisy MMLU questions, added harder questions that need reasoning, and raised the options from four to ten. They report accuracy 16 to 33 points lower than on MMLU, and less change when the prompt wording changes.

**Where the data lives.** `TIGER-Lab/MMLU-Pro`, split `test`: 12,032 questions, from 381 in history to 1,351 in math (counts from the Hugging Face card). The solved examples come from the `validation` split (70 questions, five per subject). I could not confirm the 12,032 from a run, because the saved runs cover only 2,800 questions (see "Watch out").

**What a question looks like.** The model is shown five solved questions from the same subject, each with step-by-step reasoning that ends in an `ANSWER:` line, then the real question. A real computer-science question (in the real prompt each option is on its own line):

```
Let x = 1. What is x << 3 in Python 3?
A) 16   B) 4   C) 8   D) 5   E) 10   F) 2   G) 12   H) 3   I) 1   J) 6
```

The correct answer is C. Because of the five solved examples, that prompt was about 4,700 characters long in `run-4`.

**What the model must answer.** One letter, A to J, on a last line such as `ANSWER: C`. A few questions have fewer than ten options.

**How it is graded.** By code, with the same letter-reading as GPQA-Diamond. No judge model.

**What the headline number means.** `accuracy`: the share of all questions answered correctly, with the 14 subjects pooled. Big subjects such as math count for more than small ones such as history, because EvalScope's overall score is weighted by question count and the service reads that score. Guessing gets about 11%.

**Watch out.** The saved MMLU-Pro runs (`run-2`, `run-4`) each hold 2,800 questions, 200 per subject, not 12,032. That fits a cap of 200 per subject (EvalScope applies a cap to each subject separately), but I could not confirm the cap used, because the config saved in those folders belongs to a later attempt. A score from a capped run is not the full-benchmark score.

Deep dive: [MMLU-Pro](MMLU_PRO_HOW_IT_WORKS.md)

---

## How they compare

The five fall into three families.

**Rule-following: IFEval and IFBench.** The model writes free text and code checks that the text obeys rules such as "no commas" or "exactly five numbers". Nothing checks whether the text is true or good. IFBench is the same kind of test with newer, harder rules, so the pair is best read together: a model can do well on IFEval's familiar rules and badly on IFBench's new ones.

**Multiple choice: GPQA-Diamond and MMLU-Pro.** The model reasons, then gives one letter, and the grader compares the letter with the answer key. GPQA-Diamond is small, very hard, and has four options. MMLU-Pro is large and broad, has ten options, and shows five solved examples first. Both read the answer from an `ANSWER:` line.

**Math: GSM8K.** The model works through a word problem and gives one number. Like multiple choice, one final answer is compared with a key. Unlike multiple choice, there are no options to guess from, and the grader compares numbers instead of letters.

| | IFEval | IFBench | GSM8K | GPQA-Diamond | MMLU-Pro |
|---|---|---|---|---|---|
| Family | Rule-following | Rule-following | Math | Multiple choice | Multiple choice |
| Answer given | Free text | Free text | A number | One letter (A to D) | One letter (A to J) |
| Graded by | Rule checkers | Rule checkers | Number comparison | Letter comparison | Letter comparison |
| Questions | 541 | 300 | 1,319 | 198 (x4 tries) | 12,032 |
| One question moves the score by | 0.18 points | 0.33 points | 0.08 points | 0.5 points | 0.008 points |
| 95% margin of error at a 50% score | about +/-4.2 | about +/-5.6 | about +/-2.7 | about +/-6.9 | about +/-0.9 |
| Solved examples first | none | none | 4 | none | 5 |
| Average reply length in saved runs (tokens, including hidden thinking) | about 2,700 with thinking on, about 560 with it off | about 3,300 (thinking on) | about 1,400 (thinking on) | about 8,400 (thinking on, partial run) | about 600 (settings not confirmed) |

How to read the table:

- The margin-of-error row is my own arithmetic, using the same 95% formula the leaderboard uses (`wilson_interval` in `backend/app/services/diagnostics/report_summary.py`), at a score of 50%, where the margin is widest. Near 0% or 100% it is smaller. It covers only which questions were asked, not the extra randomness from sampling.
- A token is a small piece of a word. The reply-length row comes from different checkpoints and settings (`run-15`, `run-9`, `run-16`, `run-7`, `run-6`, `run-2`, `run-4`), so it gives a rough idea only. GPQA-Diamond replies are the longest by far.
- Beyond the headline number, the score drill-down code can break a run down by rule family and by individual rule for IFEval and IFBench, and by subject for MMLU-Pro. GSM8K and GPQA-Diamond have no breakdown there. This is from `backend/app/services/diagnostics/registry.py`; I did not check what the screens show.

---

## Things to know before reading any score

1. **Scores from different benchmarks cannot be compared.** The tests differ in difficulty and in what a score means: guessing alone gets 25% on GPQA-Diamond and about 11% on MMLU-Pro. One model with the same settings scored 85.0% on IFEval (`run-15`) and 47.0% on IFBench (`run-16`). That says IFBench is harder, not that the model is worse at one skill.

2. **Few questions make a score jumpy.** On GPQA-Diamond one question moves the score by half a point and the margin of error is about 7 points, so two models a few points apart may be tied. Even on IFEval, three runs of one checkpoint with the same saved settings scored 88.7%, 86.9% and 85.4% (`run-10`, `run-11`, `run-13`). The leaderboard works out a 95% margin of error for each score. For GPQA-Diamond it is only approximate, because each question is asked four times.

3. **Thinking mode changes what is measured.** With thinking on, the model writes out its reasoning before the answer. Every recipe uses `think_handling: strip`, so the model server splits the reasoning off and only the answer is graded (the compatibility check reports an error if thinking is on and the server cannot split it). Thinking replies are much longer, so they need a higher length limit. The same checkpoint scored 63.0% on IFEval with thinking off (`run-9`: temperature 0, 8,192-token limit, about 560 tokens per reply) and 85.0% with thinking on (`run-15`: temperature 1.0, 32,768-token limit, about 2,700 tokens per reply). Several settings differ between those two runs, so the gap is not all down to thinking.

4. **A reply cut off at the length limit almost always scores wrong.** The run page shows the truncation rate (the share of replies cut off). In the saved runs, 8 of 1,319 GSM8K replies were cut off (none scored correct), 128 and 108 of 2,800 MMLU-Pro replies (4 correct in each run), and 79 of the 290 GPQA-Diamond answers in the partial run (1 correct). A low score next to a high truncation rate may mean "ran out of room", not "does not know".

5. **How the answer is read matters.** A multiple-choice reply needs an `ANSWER: <letter>` line. In the two saved MMLU-Pro runs, 92 and 86 of 2,800 replies had no readable letter and scored wrong. When the `ANSWER:` line is missing altogether, EvalScope takes the last capital letter in the reply if it is a valid option (for example the `D` in "PED"). That happened for 41 and 26 replies, and 4 of each were scored correct. GSM8K has a similar fallback to the last number in the reply.

6. **The exact prompt, solved examples and settings matter.** Change the wording, the number of solved examples, the temperature or the thinking switch, and the score moves. That is why each recipe is versioned (`ifeval/v1`, `gsm8k/v1` and so on) and the sampling settings are saved with every run. The MMLU-Pro paper reports that model scores still shift by about 2% depending on prompt style (4% to 5% on MMLU).

7. **Other teams' numbers may not match ours.** Other teams in the company run some of the same benchmarks with other tools (lm-evaluation-harness, OpenCompass), with different prompts, solved examples and answer-reading rules. `BENCHMARK_UNIFICATION_RESEARCH.md` (August 2026) lists IFEval, GPQA-Diamond and MMLU-Pro this way; I did not re-check it. Numbers published elsewhere can differ for the same reasons (from general knowledge, not verified). Our data is pinned only by the harness image tag, and MMLU-Pro has been corrected several times upstream (the latest correction on its card is from January 2026), so I could not confirm which version is in our image.

8. **The evidence in this repo is still thin.** Four of the five recipes say their reference score is "NOT YET RUN". IFEval has one (74.12% under the greedy profile, from a finished run of `Qwen3-4B-allternary-ep03` by the tool-call team's harness) and none for thinking mode. There is no finished GPQA-Diamond run in `runs/`, and the saved MMLU-Pro runs cover 2,800 of the 12,032 questions. Run folders were also reused, so some config and log files belong to a later attempt than the answers beside them (`run-2` holds MMLU-Pro answers next to an IFBench config); I relied on the predictions and reports. Treat the first full run of each recipe as unverified until it is compared with a trusted number.

---

## Where to read more

**One deep-dive page per benchmark**

- [IFEval](IFEVAL_HOW_IT_WORKS.md)
- [IFBench](IFBENCH_HOW_IT_WORKS.md)
- [GSM8K](GSM8K_HOW_IT_WORKS.md)
- [GPQA-Diamond](GPQA_DIAMOND_HOW_IT_WORKS.md)
- [MMLU-Pro](MMLU_PRO_HOW_IT_WORKS.md)

**Related notes**

- [BENCHMARK_UNIFICATION_RESEARCH.md](BENCHMARK_UNIFICATION_RESEARCH.md): how other teams run benchmarks with the same names using other tools, and why their numbers can differ from ours.

**Where things live in this repo**

| What | Where |
|---|---|
| The five recipes | `catalog/standards/` |
| Turning a recipe into an EvalScope config | `backend/app/services/harness/task_config.py` |
| Reading the report EvalScope writes | `backend/app/services/harness/parser.py` |
| Copying the datasets into the harness image | `harness/evalscope/prefetch_dataset.py` |
| Which benchmarks the score drill-down knows about | `backend/app/services/diagnostics/registry.py` |

**The original papers and dataset cards** (opened in October 2026)

| Benchmark | Paper | Dataset card |
|---|---|---|
| IFEval | https://arxiv.org/abs/2311.07911 | https://huggingface.co/datasets/google/IFEval |
| IFBench | https://arxiv.org/abs/2507.02833 | https://huggingface.co/datasets/allenai/IFBench_test |
| GSM8K | https://arxiv.org/abs/2110.14168 | https://huggingface.co/datasets/openai/gsm8k |
| GPQA-Diamond | https://arxiv.org/abs/2311.12022 | https://huggingface.co/datasets/Idavidrein/gpqa |
| MMLU-Pro | https://arxiv.org/abs/2406.01574 | https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro |

The memorization study mentioned in the GSM8K section is at https://arxiv.org/abs/2405.00332. To confirm how EvalScope reads answers, caps questions per subject and averages scores, I read its source at the commit this service pins: https://github.com/modelscope/evalscope/tree/2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85.
