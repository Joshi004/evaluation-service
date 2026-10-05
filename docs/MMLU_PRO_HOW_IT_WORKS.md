# How MMLU-Pro works in this service

MMLU-Pro is a big multiple-choice exam. It has 12,032 questions in 14 subjects, and most questions have ten answer options. The model is shown five worked examples from the same subject, then one new question, and has to finish its reply with `ANSWER: X`. We read that letter, compare it with the answer key, and report the share of questions it got right.

This page explains what the test is, what a question looks like, how a reply is graded, what is specific to running it here, and what I found odd while checking. Facts about the benchmark come from the sources at the bottom. Facts about this service come from the repo and from the two real outputs in `runs/run-2` and `runs/run-4`. I did this research on 3 October 2026. Where I could not confirm something, I say so.

The general path of a run (submit, model server, container, files on disk) is the same as for IFEval and is explained in [IFEVAL_HOW_IT_WORKS.md](IFEVAL_HOW_IT_WORKS.md). This page does not repeat it.

---

## What MMLU-Pro is testing

MMLU-Pro is a knowledge-and-reasoning quiz. Picture a long exam with questions from biology, law, physics, history, economics and nine other subjects. Each question has one right answer among the options. The model has to pick it.

It is the harder sequel to MMLU, an older exam with 57 subjects and four options per question. By 2024 the best models were so close together on MMLU that it could no longer tell them apart. The paper's example: GPT-4o and GPT-4-Turbo were 1 point apart on MMLU and 9 points apart on MMLU-Pro. TIGER-Lab (University of Waterloo) published MMLU-Pro in June 2024, and the authors' GitHub page lists it as a NeurIPS 2024 paper. They changed three things:

- **Ten options instead of four.** Guessing gets harder. Scores also move less when the prompt wording changes: about 2% across 24 prompt styles, against 4 to 5% on MMLU.
- **Harder questions.** They dropped every MMLU question that more than four of eight small test models already got right (5,886 questions). They added new ones from a STEM problem website (stemez.com), TheoremQA (problems that apply a named theorem) and SciBench (college-textbook science problems). Of the final 12,032, 6,810 come from MMLU and 5,222 are new.
- **Cleaner questions.** Experts removed questions that need an image or a table, or that lack the information to be answered. Then a model flagged options that might actually be correct, and people checked those.

The skills it asks for are uneven. Law, history, philosophy and psychology are mostly about knowing things. Math, physics, chemistry and engineering need several steps of working. The paper found that thinking step by step helps a lot here (GPT-4o: 72.6% with it, 53.5% without) and does not help on MMLU.

What it does **not** test:

- Writing quality or obeying formatting rules. That is what IFEval and IFBench are for.
- Free-form answers. Every answer is one letter.
- Tool use, long conversations, images, or long documents.
- Whether the reasoning is any good. Only the final letter counts.

The paper names its own limit: multiple choice cannot show the depth of an open-ended answer.

---

## At a glance

| | |
|---|---|
| Recipe | `mmlu_pro/v1-full` (`catalog/standards/mmlu_pro-v1-full.yaml`) |
| Made by | TIGER-Lab, University of Waterloo, June 2024 (arXiv 2406.01574) |
| Questions | 12,032 in `test`, plus 70 in `validation` that are only used as worked examples |
| Subjects | 14 |
| Options | Up to 10 (A to J). 83% of questions have ten, the rest have 3 to 9. Average 9.47. |
| Worked examples | 5 per question, the same five for every question in a subject |
| Model must end with | `ANSWER: X` |
| Score | `accuracy`: the share of questions answered correctly. It is the only metric. |
| Guessing level | About 11% (my calculation: the average of 1 divided by the number of options) |
| Answers per question | 1 |
| Requests in flight | 128 |
| Default sampling | `greedy`: temperature 0 (always take the most likely next piece of text), at most 8,192 new tokens, thinking off. A token is a word piece, about three-quarters of a word. |
| Reference score | Not produced yet. The recipe says "NOT YET RUN" and I have not made one up. |
| Real outputs in the repo | `runs/run-2` and `runs/run-4`: checkpoint (the saved model) `Qwen3-4B-allternary-ep03`, the first 200 questions of every subject (2,800 in all), scoring 45.0% and 45.3% |

---

## Where the questions live

**Original home.** The dataset is `TIGER-Lab/MMLU-Pro` on Hugging Face. The authors' code is on GitHub as `TIGER-AI-Lab/MMLU-Pro`. The license is MIT.

**What the recipe asks for.** Dataset `TIGER-Lab/MMLU-Pro`. Split `test` (the questions that are asked). `train_split` is `validation` (where the worked examples come from). `dataset_revision` is empty, so no version is pinned.

**Size.** `test` has 12,032 questions and `validation` has 70 (five per subject). Questions per subject: math 1,351; physics 1,299; chemistry 1,132; law 1,101; engineering 969; other 924; economics 844; health 818; psychology 798; business 789; biology 717; philosophy 499; computer science 410; history 381. (`other` is a catch-all for questions that fit none of the other groups.)

**One row** has these fields:

- `question_id`: a unique number. The service uses it as the sample key in its diagnostics.
- `question`: the question text. Math and science are written in LaTeX, with dollar signs.
- `options`: the list of answer options, 3 to 10 of them.
- `answer` and `answer_index`: the right letter and its position (F is 5).
- `cot_content`: a worked step-by-step solution. Filled in only for the 70 `validation` rows, blank in `test`.
- `category`: the subject.
- `src`: where the question came from. 6,810 are carried over from MMLU (`ori_mmlu-high_school_biology`). The rest come from the STEM website (4,083, `stemez-Chemistry`), TheoremQA (598, `theoremQA-Math`) and SciBench (541, `scibench-atkins`).

**How it gets into EvalScope.** EvalScope is the open-source tool that runs inside our container, builds the prompts and grades the replies. The dataset is copied into the container image when the image is built (`harness/evalscope/Dockerfile` runs `prefetch_dataset.py`), so a run does not download anything. EvalScope fetches it through its ModelScope loader (ModelScope is a Hugging Face-like hub that holds the same dataset id) and saves it in its own on-disk cache, which a real run reads first. The prefetch script itself says the build has not yet been tested end to end from scratch, and that a container run with the network switched off has not yet been tried. I could not test either, because I may not run Docker.

**The copy can drift.** Nothing pins the dataset version, and the authors keep correcting it. Their changelog lists fixes in July to September 2024, April 2025, October 2025 and January 2026 (spaces at the start of options in STEM questions, which the authors say could have been used as a shortcut). The image tag (`2ce95c3-tier1`) names the EvalScope version and the set of datasets, not the day the data was downloaded. A rebuild under the same tag could quietly pick up a newer copy. One check I did: prompts rebuilt from today's public copy match all 2,800 prompts in both real runs, character for character. So for those questions and the 70 worked examples, nothing has changed since September.

**Where the results go.** Each run gets a folder, `runs/run-<id>/`:

- `predictions/<model>/mmlu_pro_<subject>.jsonl`: one line per question: the message sent, the reply, token counts, why the reply stopped, time taken.
- `reviews/<model>/mmlu_pro_<subject>.jsonl`: one line per question: the answer key, the letter EvalScope read, and the 0 or 1 score.
- `reports/<model>/mmlu_pro.json`: the roll-up with the overall and per-subject scores.
- `diagnostics/<model>/mmlu_pro.json`: the service's own digest, built later from the two folders above.

The backend also saves the headline score, the whole report and the share of replies that hit the token limit on the run's database record. File names carry the subject, space included (`mmlu_pro_computer science.jsonl`), so code must search for the files rather than build their names.

---

## What a question looks like

Every question reaches the model as one chat message and nothing else: no system message. The message holds a short instruction, five worked examples from the same subject, then the new question. The examples come from the 70 `validation` rows. Below are real cases from run-4 (`Qwen3-4B-allternary-ep03`). Run-2 gave the same result on examples 1 to 3.

### Example 1: biology, answered correctly

**The row.** In the file, `options` is a plain list. I added the letters for reading.

```
question_id:  2810
category:     biology
src:          ori_mmlu-high_school_biology
question:     The theory of evolution is most accurately described as
options:      A  a universally accepted fact about the origin and development of all species.
              B  a hypothesis in the process of being tested and verified.
              C  a disproven theory about the development of species over time.
              D  a speculation about possible changes in populations over time.
              E  an opinion that some scientists hold about how living things change over time.
              F  an overarching explanation, supported by much evidence, for how populations change over time.
              G  one possible explanation, among several scientific alternatives, about how species have come into existence.
              H  an educated guess about how species originate.
              I  an assumption based on observations of a few species.
              J  a religious belief about the origin of species.
answer:       F   (answer_index 5)
cot_content:  (blank)
```

**The message the model receives** (5,846 characters, about 1,470 tokens). The first worked example is shown in full. Four more worked examples (about 3,700 characters) and options B to I of the last block are left out. Notes inside `<< >>` are mine, not part of the message:

```
The following are multiple choice questions (with answers) about biology. Think step by step and then finish your answer with 'ANSWER: [LETTER]' (without quotes) where [LETTER] is the correct letter choice.

Question:
Which of the following represents an accurate statement concerning arthropods?
Options:
A They possess an exoskeleton composed primarily of peptidoglycan.
B They possess an open circulatory system with a dorsal heart.
C They are members of a biologically unsuccessful phylum incapable of exploiting diverse habitats and nutrition sources.
D They lack paired, jointed appendages.
E N/A
<< F to J are also "N/A" >>
A: Let's think step by step. Peptidoglycan is known to comprise the plasma membrane of most bacteria, rather than the exoskeleton of arthropods, which is made of chitin, which rules out (A). The answer (C) is false because arthropods are a highly successful phylum. Likewise, arthropods have paired, jointed appendages, which rules out (D). The only remaining option is (B), as arthropods have an open circulatory system with a dorsal tubular heart. ANSWER: B.

<< four more worked examples left out >>

Answer the following multiple choice question. The last line of your response should be of the following format: 'ANSWER: [LETTER]' (without quotes) where [LETTER] is one of A,B,C,D,E,F,G,H,I,J. Think step by step before answering.

Question:
The theory of evolution is most accurately described as
Options:
A) a universally accepted fact about the origin and development of all species.
<< B) to I) left out; same text as in the row above >>
J) a religious belief about the origin of species.
```

Things to notice in the message:

- `A:` at the start of each worked solution means "answer". It is not option A.
- The first worked example has only four real options, so six lines say `N/A`. That padding exists in 21 of the 70 worked examples. In the real question block, only real options are listed, and the letters have a bracket (`A)`), unlike the examples (`A`).
- The instruction line before the final question lists the valid letters. A four-option question says `one of A,B,C,D`.

**The model's reply** (116 tokens, 3 seconds):

```
Let's think step by step. The theory of evolution is a well-established scientific concept that explains how species change over time through mechanisms such as natural selection, genetic variation, and inheritance. It is not a fact, but rather a hypothesis that has been extensively tested and supported by a vast amount of evidence. The theory is not a speculation or an assumption, but rather a comprehensive explanation that has been refined through scientific inquiry. Therefore, the most accurate description is that it is an overarching explanation, supported by much evidence, for how populations change over time. ANSWER: F.
```

**How it was graded.** `ANSWER: F.` sits at the end of a sentence, not at the start of a line. So EvalScope's third pattern ("anywhere in the text") found it. It read `F`. The key is `F`. Score 1. The reply also contains a muddled sentence ("It is not a fact, but rather a hypothesis"), which does not matter: only the letter is read.

### Example 2: math, marked wrong, and arguably unfairly

**The row.**

```
question_id:  7751
category:     math
src:          ori_mmlu-high_school_mathematics
question:     Suppose $f(x)$ is an invertible function, and suppose that $f(2)=f^{-1}(2)=4$. What is the value of $f(f(2))$?
options:      A $f(4)$   B $f(f^{-1}(2))$   C 1   D $f^{-1}(4)$   E $f^{-1}(2)$
              F 8   G 16   H 0   I 2   J 4
answer:       I   (answer_index 8)
```

**The message** is shaped like example 1's: an opening sentence "about math", five worked math examples (about 4,100 characters), then this question in the same `Question:` / `Options:` layout with `A)` to `J)`. About 1,790 tokens in all.

**The model's reply** (123 tokens, 2 seconds):

```
We are given that $ f(2) = 4 $ and $ f^{-1}(2) = 4 $. Since $ f $ is invertible, we know that $ f(f^{-1}(2)) = 2 $. However, we are asked to find $ f(f(2)) $.

From the given, $ f(2) = 4 $, so $ f(f(2)) = f(4) $.

Thus, the value of $ f(f(2)) $ is $ f(4) $, which corresponds to option A.

ANSWER: A.
```

**How it was graded.** `ANSWER: A.` is on a line of its own, so the first pattern read it: `A`. The key is `I`. Score 0. But look at the options. Since `f^{-1}(2) = 4`, we get `f(4) = 2`. So option A (`f(4)`), option B, option D and option I are all equal to 2. By my own reading, the model picked one of four correct options and the key accepts only one. That is a flaw in the question, not in the model, and a small example of what "noisy labels" means. The paper's own review of 120 GPT-4o mistakes put bad labels at about 2%.

### Example 3: economics, never finishes

**The row.**

```
question_id:  6963
category:     economics
src:          ori_mmlu-high_school_macroeconomics
question:     Which of the following is a consequence of removal of a protective tariff on imported steel?
options:      A The quality of imported steel decreases.
              B Domestic steel producers lose their job.
              C Income is transferred from domestic steel consumers to foreign steel producers.
              D Income is transferred from steel consumers to domestic steel producers.
              E Allocative efficiency is improved.
              F Imports fall.
              G The price of imported steel increases.
              H Income is transferred from foreign steel producers to domestic steel producers.
              I The supply of domestic steel decreases.
              J The demand for domestic steel increases.
answer:       E   (answer_index 4)
```

**The message** has the same layout: "about economics", five worked examples (about 3,600 characters; every one of them says "We refer to Wikipedia articles on ... for help"), then this question. About 1,235 tokens.

**The model's reply** (8,192 tokens, 118 seconds, 42,999 characters). The middle is left out (my note is in `<< >>`):

```
Let's think step by step. We refer to Wikipedia articles on international trade for help. The removal of a protective tariff on imported steel leads to an increase in the price of imported steel, as tariffs are removed and the market becomes more competitive. This results in a decrease in the price of imported steel, which is the opposite of what is stated in option G. However, the correct consequence is that the pri
<< about 42,000 more characters left out >>
 an option. The correct consequence is that the price of imported steel decreases, which is not listed as an option. The correct consequence is that the price of imported steel decreases, which is not listed as an option. The correct consequence is that the price of imported steel decreases, which is not listed as
```

**How it was graded.** There is no `ANSWER:` anywhere, because the reply was cut off by the 8,192-token limit. EvalScope then falls back to the last capital letter in the text. That is the `T` of the last "The", which is not an option letter, so no answer is recorded. Score 0. The model repeats one sentence until the limit stops it. A higher limit would not help. The "Wikipedia" phrase is copied from the style of the worked examples; the model cannot look anything up.

### A few more real cases

- **Cut off, but scored right (math 7722).** "Which list of numbers is ordered from least to greatest?", eight options, key `F`. In run-4 the model compared the options one by one, got stuck repeating "Option F" and was cut off in the middle of it. With no `ANSWER:` line, the fallback took the last capital letter, the `F` in "Option F". That matches the key, so it scored 1, even though the model had just said option F "is not in order". In run-2 the same model finished normally (1,055 tokens) and answered `F`.
- **A letter that does not exist (computer science 10521).** A four-option question about remote procedure calls. The model argued that none of the options is correct, wrote "the answer is N/A", then `ANSWER: I`. There is no option I here, so no answer: score 0.
- **A calculation question (physics 9145, from SciBench).** A particle with charge -2.0e-9 C feels a force of 3.0e-6 N. What is the electric field? The model divided, got 1.5e3 N/C, and ended `ANSWER: B.` Right. A miss on this kind of question can look like physics 9060: the model used the wrong formula in step one (power as current times resistance), then wrote a tidy chain and a confident wrong letter.

---

## What the model has to produce

One plain-text reply. The prompt asks it to think step by step first, so most replies are a short chain of reasoning ending in `ANSWER: X`, where `X` is a letter that exists for that question.

- **What is read:** only the letter after `ANSWER:`. The reasoning above it is never graded.
- **Where the answer sits does not matter.** The instruction says it should be the last line. The worked examples put it at the end of the last sentence instead ("... ANSWER: B."), and the model copies that. In run-4, 1,914 replies (68%) had `ANSWER:` at the start of a line. 778 (28%) had it somewhere else, and in 775 of those it was at the very end of the reply, on the same line as the last sentence. Both kinds are read, and both scored about 47% (47.2% and 46.5%).
- **Wrong format scores 0**, even if the reasoning was fine. In run-4, 108 replies had no `ANSWER:` line at all, and 107 of those were cut off at the token limit. For 26 of the 108 the last capital letter happened to be a real option (4 were right by luck). For 82 it was not, so the answer was empty. Four more replies had an `ANSWER:` line the grader rejected: three named a letter that does not exist for that question (`I` on a four-option question, for example) and one wrote the option's words (`ANSWER: I and III only.`).
- **Small letters or two letters** (`ANSWER: b`, `ANSWER: AB`) would be rejected too. I know this from reading the code. It did not happen in the real runs.
- **Running out of tokens.** The default profile allows 8,192 new tokens. In run-4, 108 of 2,800 replies (3.9%) hit that limit, and 128 did in run-2. Replies that finish are short: the median is about 180 tokens, and only 1% went past about 1,100. By one simple test, every cut-off reply in both runs was a runaway loop like example 3: squeezed with a standard compressor, they shrink to under 10% of their size (median 3%), against about 30% for ordinary replies of 1,000 tokens or more. The cut-off replies produced 55% (run-4) and 60% (run-2) of all output tokens from 4 to 5% of the replies. Only 4 of the 108 scored right, by luck.
- **Thinking.** With the default profile thinking is off and the model reasons in its visible reply. With a thinking profile (for example `qwen3_think`: temperature 0.6, up to 16,384 tokens), the model writes a long private chain of thought first. The model server must then split that out (`--reasoning-parser qwen3`), and only the answer part is graded (`think_handling: strip`). The service refuses a thinking run on a server without that parser (`strip_needs_reasoning_parser` in `rules.py`). The token limit covers thinking and answer together. If the limit hits during thinking, there is no answer to grade. I could not confirm exactly what the server hands back in that case. No MMLU-Pro run with thinking exists in `runs/`.

---

## How the grading works

EvalScope does the grading. The service only reads the result.

1. **Take the reply text.** If thinking was on and the server split it out, only the answer part is used. With thinking off, the whole reply is used.
2. **Look for `ANSWER:`.** EvalScope tries three patterns and stops at the first that matches. Capital or small letters in the word `ANSWER` do not matter. If one pattern matches more than once, the first match counts.
   1. `ANSWER: X` at the start of a line.
   2. `ANSWER: (X)` with brackets.
   3. `ANSWER: X` anywhere in the text.
3. **No `ANSWER:` anywhere? Fall back.** It takes the last capital letter in the reply. That counts only if it is a real option letter for that question. Otherwise the answer is empty.
4. **Check the letter.** It must be exactly one capital letter that exists for the question (A to D on a four-option question, A to J on a ten-option one). `b`, `AB`, `I and III only` or a letter past the last option all become an empty answer.
5. **Score.** The letter must equal the answer key. Right is 1. Wrong or empty is 0. No partial credit.
6. **Average.** Per subject: right answers divided by questions asked in that subject. Overall: every question counts the same, so big subjects count more. EvalScope also writes a second overall number, the plain average of the 14 subject scores. The two are the same in the real runs only because every subject had exactly 200 questions. The service reads the first one (`accuracy:mean` in the recipe). Each question is asked once here, so there is no averaging across repeats (GPQA-Diamond asks four times and averages).

The service keeps the headline, the whole report and the share of replies that hit the token limit. A diagnostics file built later adds per-subject results, tags such as `truncated`, and a three-line summary. The 95% range for the headline (roughly: how far the score could move if a different random set of similar questions had been asked) is not stored. The backend works it out from the score and the number of questions when the run page, the leaderboard or the compare view is requested (`wilson_interval` in `report_summary.py`).

**What the per-subject numbers are for.** Finding where a model is weak. Run-2 and run-4 scored the first 200 questions of each subject, sorted here by run-4:

| Subject | In full set | Share | Run-2 | Run-4 | Cut off (run-4, of 200) |
|---|---|---|---|---|---|
| math | 1,351 | 11.2% | 65.0% | 63.5% | 10 |
| biology | 717 | 6.0% | 60.5% | 61.0% | 6 |
| business | 789 | 6.6% | 56.5% | 57.0% | 8 |
| economics | 844 | 7.0% | 55.0% | 53.0% | 3 |
| computer science | 410 | 3.4% | 51.0% | 51.5% | 10 |
| physics | 1,299 | 10.8% | 49.5% | 51.5% | 12 |
| chemistry | 1,132 | 9.4% | 47.5% | 49.0% | 21 |
| psychology | 798 | 6.6% | 47.5% | 46.5% | 1 |
| engineering | 969 | 8.1% | 38.5% | 39.0% | 23 |
| other | 924 | 7.7% | 37.5% | 39.0% | 3 |
| health | 818 | 6.8% | 34.5% | 36.0% | 2 |
| history | 381 | 3.2% | 32.0% | 33.0% | 1 |
| philosophy | 499 | 4.1% | 32.0% | 32.5% | 2 |
| law | 1,101 | 9.2% | 23.5% | 22.0% | 6 |
| **Overall** | 12,032 | 100% | 45.0% | 45.3% | 108 |

Run-4 got 1,269 of 2,800 right, run-2 got 1,261. Three cautions when reading the table:

- **Neighbouring subjects are not really different.** With 200 questions, a subject's score has a 95% range of about plus or minus 7 points from the choice of questions alone (my calculation, using the same formula as the service). Only big gaps mean something, such as law at 22% against math at 63.5%. On the full set the subjects have 381 to 1,351 questions, so the ranges shrink to about plus or minus 5 to 3 points.
- **A 200-per-subject slice weights subjects equally; the full set does not.** Re-weighting the same subject scores by the full-set sizes gives 46.0% (run-2) and 46.2% (run-4). That is an illustration, not a result.
- **Law is hard for everyone.** In the paper, GPT-4o scored 51.0% on law against 72.6% overall. So a low law score alone says little about our model.

**One more difference from the paper.** The paper's own scripts look for "answer is (X)" and, if nothing is found, pick a random option. EvalScope uses `ANSWER: X` and scores no answer as wrong. So numbers from this service cannot be set directly beside the paper's table.

---

## How a run goes here

Everything in the general flow is the same as for IFEval. These are the parts that differ for MMLU-Pro.

- **Worked examples first.** EvalScope builds each message from the `validation` split: the five questions of that subject, shown with their solutions. The recipe's `few_shot_prompt_template` is empty on purpose, because the MMLU-Pro adapter builds the examples with its own code and never reads that field.
- **14 subjects run as 14 subsets.** The recipe lists them in EvalScope's own order. The list is part of the recipe's identity, so the order is not changed. Each subject gets its own predictions and reviews file.
- **`sample_limit` counts per subject.** A limit of 200 gives 2,800 questions, not 200. That is how the two real runs were made: the first 200 of each subject, in file order (I checked: the question ids match exactly). The recipe leaves the limit empty, meaning all 12,032, and says it must stay empty on a published run.
- **128 requests in flight** (`eval_batch_size`), against 32 for the other four benchmarks. The recipe's own comment quotes a measurement by the tool-call team: MMLU-Pro went from 2,179 to 3,950 tokens per second moving from 32 to 128, because short replies leave the GPU idle when too few requests are in flight. I could not re-measure that. The setting is not part of the recipe's identity, so it can change without making a new standard.
- **30 minutes per request** (`request_timeout_seconds: 1800`). The slowest request in the two real runs took about 232 seconds.
- **Sampling.** The recipe adds no overrides. The default profile for every checkpoint is `greedy` (temperature 0, top-p 1, 8,192 new tokens, thinking off, seed 42).
- **Errors.** `ignore_errors` is on, so one failed request does not lose the run. In run-4 none failed.
- **Answers per question.** One (`repeats: 1`). With 12,032 questions the recipe does not need more.

**How long it takes.** Judging by file times, run-2 took about 7.7 minutes and run-4 about 6.2 minutes for 2,800 questions (from the run folder being created to the report being written, so start-up is included). That is about 3,800 and 4,300 output tokens per second overall. If the speed held, all 12,032 questions would take roughly 27 to 33 minutes. That is my arithmetic, not a measurement, and it assumes thinking off. Two things would make it much longer: thinking mode, and the 4 to 5% of replies that loop to the limit. Those replies are the slowest requests (up to about 232 seconds) and gave 55 to 60% of all output tokens, so a few stragglers set the finishing time.

**Were 128 requests really in flight?** The saved settings of these two runs were overwritten (see "Gaps and surprises"), so I cannot read the batch size. But the stored numbers give a hint. Adding up the time of every request and dividing by the wall-clock time gives about 100 requests in flight on average in both runs (run-4: 36,800 seconds of requests in about 373 seconds). That fits 128 and rules out 32.

**How long the model server lives.** The model server's job on the cluster has a time limit, `slurm_walltime_seconds`, which defaults to 7,200 seconds (2 hours) in `backend/app/config.py`. The harness container has no timeout of its own, and the check that decides whether to reuse a running server only asks whether it has expired, not how much time is left. A full run without thinking should fit in two hours by my estimate. A thinking run might not. I did not read `.env`, so I do not know the real value in use. The recipe asks whoever does the first full run to record the real wall-clock time.

---

## How it compares to the other benchmarks

| | IFEval | IFBench | GSM8K | GPQA-Diamond | MMLU-Pro |
|---|---|---|---|---|---|
| What it checks | following rules in writing tasks | the same, with newer, harder rules | grade-school math word problems | graduate-level science questions | broad exam-style knowledge and reasoning |
| Questions | 541 | 300 | 1,319 | 198 | 12,032 |
| Answer form | free text, checked by code | free text, checked by code | a number | one letter of 4 | one letter of up to 10 |
| Worked examples shown | 0 | 0 | 4 | 0 | 5 |
| Answers per question | 1 | 1 | 1 | 4, averaged | 1 |
| Scores kept | 4 | 4 | 1 | 1 | 1 |
| Requests in flight | 32 | 32 | 32 | 32 | 128 |
| Guessing level | none | none | none | 25% | about 11% |
| 95% range from question count alone, at a 50% score (points) | 4.2 | 5.6 | 2.7 | 6.9 | 0.9 |

The last row is plus or minus. It uses the service's own formula and covers which questions were picked, not how much the model's answers vary between runs.

### GPQA-Diamond, the closest relative

Both are multiple choice. Both sit under "Knowledge & reasoning". Both use the same instruction sentence and the same `ANSWER: X` reading code. The differences matter more than the likeness. For the full picture, see [GPQA_DIAMOND_HOW_IT_WORKS.md](GPQA_DIAMOND_HOW_IT_WORKS.md).

- **Breadth against depth.** MMLU-Pro covers 14 subjects at school, college and professional-exam level, including law, history and business. GPQA-Diamond is 198 questions in biology, physics and chemistry, written by PhD-level experts. The GPQA paper (November 2023) built the Diamond set from questions that both expert checkers got right and most non-expert checkers got wrong. In the paper, experts scored about 65% on the full question set, skilled non-experts with half an hour and the open web scored 34%, and the best GPT-4 baseline scored 39%.
- **Four options against ten.** Guessing gets 25% on GPQA-Diamond and about 11% on MMLU-Pro. So the same score sits further above guessing on MMLU-Pro.
- **Size and noise.** 198 questions give a range of about plus or minus 7 points for one pass, from the choice of questions alone. The GPQA recipe answers with four answers per question, averaged. That calms the model's own randomness but not the question-count noise, and under the default `greedy` profile the four answers should mostly be identical anyway (the recipe says so too). MMLU-Pro's 12,032 questions give about plus or minus 1 point, and it asks each question once.
- **Worked examples.** GPQA-Diamond is zero-shot: no worked examples, and its message has no `Question:` / `Options:` labels. MMLU-Pro shows five examples first, which is why its messages are about 1,400 tokens long and most of that is examples.
- **Where the data comes from.** GPQA comes from a ModelScope copy (`AI-ModelScope/gpqa_diamond`) with a single split named `train`. MMLU-Pro comes from the authors' own dataset id with real `test` and `validation` splits.
- **Cost.** GPQA-Diamond is a small job: 4 x 198 = 792 answers. MMLU-Pro is the biggest of the five: 12,032 questions, each with about 1,400 tokens of input.
- **Using them together.** MMLU-Pro tells you how broad and steady a model is on exam-style questions, with a tight number. GPQA-Diamond tells you whether it can handle expert-level science, with a loose number. A 2-point gap between two checkpoints on the full MMLU-Pro is probably real (about plus or minus 1 point per score, same questions for both). On GPQA-Diamond a 2-point gap is well inside the noise.

### The others

- **IFEval and IFBench** check whether rules were obeyed ("use no commas"). The content is never judged, and each gives four scores. MMLU-Pro is the opposite: only the content is judged, and the format matters only in that the letter has to be findable. See [IFBENCH_HOW_IT_WORKS.md](IFBENCH_HOW_IT_WORKS.md) for IFBench.
- **GSM8K** is closest in spirit on step-by-step reasoning, but the answer is an open number (no guessing), it shows four worked examples, and it covers one skill. MMLU-Pro's `math` subject alone has 1,351 questions, from elementary-school ones (`ori_mmlu-elementary_mathematics`) to TheoremQA problems. See [GSM8K_HOW_IT_WORKS.md](GSM8K_HOW_IT_WORKS.md).
- For all five side by side, see [BENCHMARKS_OVERVIEW.md](BENCHMARKS_OVERVIEW.md).

---

## Things worth knowing

### How to read a score

A score means little without something to compare it with. These are the anchors I could source:

- **Guessing:** about 11% (my calculation).
- **The paper (June 2024), five worked examples, its own prompt and answer reading:** GPT-4o 72.6%, Claude-3-Opus 68.5%, GPT-4-Turbo 63.7%, Phi-3-mini 45.7%, Llama-3-8B-Instruct 41.0%, Gemma-2B 15.9%.
- **Qwen3-4B-Base:** 50.58%, from the Qwen3 technical report (five worked examples, step by step). The model card for Qwen3-4B-Instruct-2507 reports 58.0% for Qwen3-4B in non-thinking mode and 69.6% for the 2507 model. I did not check the settings behind those two.
- **Today's top:** the Hugging Face dataset page lists 141 results. The top ten run from 86.4% to 88.1%. None is marked verified. They come from each model's own card (or a third-party collection), so the prompts and settings behind them can differ.
- **Our two real runs:** 45.0% and 45.3% for `Qwen3-4B-allternary-ep03`, on 2,800 questions.

None of these used the same model, prompt and answer reading as ours, so I will not call 45% good or bad. It is below all three Qwen3-4B figures above (50.6%, 58.0%, 69.6%). I do not know what `allternary-ep03` changed about the base model, so I cannot say whether that gap is expected. The recipe says the reference score has not been produced yet. That is the number to wait for.

**How much a score jumps.** Run-2 and run-4 used the same checkpoint and the same 2,800 questions. Overall scores differed by 0.3 points (45.0% against 45.3%). They gave word-for-word identical replies on 67.5% of questions and the same letter on 91.7%. 78 questions flipped: 35 were right only in run-2 and 43 only in run-4. I cannot confirm the temperature of those runs (the settings were overwritten), but the default profile is temperature 0, so this suggests that even "deterministic" runs on a busy GPU server are not perfectly repeatable. Separately, the choice of questions adds noise: about plus or minus 1.8 points on 2,800 questions (the service's own formula gives 43.5% to 47.2% for run-4), about plus or minus 0.9 on all 12,032.

### What can mislead

- **Format and loops look like wrong answers.** 4 to 5% of replies never reach an answer, and a handful more name a letter that does not exist. These score 0 and show up as "the model got it wrong", although the cause is a loop or a format slip.
- **Some questions are flawed.** Example 2 has four correct options. The authors still ask people to report mistakes, and their changelog shows corrections through 2026. The paper put bad labels at about 2% of GPT-4o's errors.
- **Room at the top is running out.** MMLU-Pro was built because MMLU scores had bunched together. The top ten on the Hugging Face page now sit within 1.7 points (86.4% to 88.1%). That is my reading of those numbers, not a claim from the authors.
- **Training-data overlap.** 56.6% of the questions are carried over from MMLU, which has been public for years. I found no section in the paper about checking for overlap, and I could not check it myself.
- **Wording still matters.** The paper puts prompt sensitivity at about 2% (up to 3.74%). Our wrapper, the single-message layout and the `ANSWER:` reading are not the paper's.
- **Thinking changes everything.** A thinking run is slower, its replies are far longer, and only the final answer is graded. The paper found that step-by-step reasoning helps a lot on MMLU-Pro, so a thinking model is expected to score higher. That is an expectation, not something I measured.

### How other teams run it

From `docs/BENCHMARK_UNIFICATION_RESEARCH.md`: the tool-call team runs MMLU-Pro with EvalScope, the same tool as here, and the medpsy team runs it with a different tool, OpenCompass, implemented separately. That document says medpsy's tool reads answers with a simple pattern first and asks a judge model only if the pattern finds nothing. Here there is no judge model. The recipe (quoting older research notes) says medpsy runs only the health subject, which is why this recipe is called `-full`. A health-only recipe would be a different standard on the same dataset. Until two teams match on subjects, prompt and answer reading, "MMLU-Pro" from each is a different test. The older notes, which are no longer in the repo but can be read in git history, also describe MMLU-Pro as a 24-hour job and say the tool-call team's old setup once lost a job at 49%. I could not reconcile that with the roughly 30 minutes estimated above. Thinking mode and slower hardware are the likely reasons, but that is a guess.

### Gaps and surprises I found

1. **The saved settings in `runs/run-2` and `runs/run-4` are not from these MMLU-Pro runs.** `harness_task_config.json`, `configs/task_config.yaml`, `logs/` and `harness_stdout.log` in both folders belong to later runs of a different model (`Qwen3.5-0.8B-Think-MOPD-mixv2-RL-v11c-s810`) on IFBench (run-2) and GPQA-Diamond (run-4). They reused the same folder names. The real settings are gone. From the outputs I can tell: the first 200 of each subject, replies capped at 8,192 tokens, no thinking text, one user message. I could not confirm temperature, seed or batch size. Both runs also finished before the recipe file was first committed (11 September 2026, 11:04 local time; the runs finished at 09:39 and 10:17). The file may have existed uncommitted by then, so I cannot tell which version of the recipe they used.
2. **The diagnostics sentence about cut-off replies is misleading here.** It says they are "a mechanical failure, not a model one" (`narrate.py`). Every cut-off reply I checked was a loop, so a bigger limit would not fix them.
3. **Sample previews show the instruction, not the question.** The diagnostics keep the first 300 characters of the message. For MMLU-Pro that is the instruction and the start of the first worked example, so all 200 samples of a subject share one preview (14 different previews in the whole run). Open the sample's reply file to see the real question.
4. **The speed numbers in the report are per request.** "43.71 output tokens per second" and "0.076 requests per second" (run-4) are averages for one request. The whole run produced about 4,300 tokens per second. Do not read 0.076 as the run's speed.
5. **The prompt allowance is smaller than real MMLU-Pro prompts.** `rules.py` assumes 2,048 tokens of prompt when checking that a sampling profile fits the model's context window, and its comment calls that generous. In run-4 the prompts averaged about 1,390 tokens and the longest was 2,599. 157 of 2,800 (5.6%) were over 2,048. With the shipped profiles (32,768-token window, at most 16,384 new tokens) this does not bite, but a smaller window could.
6. **The worked examples and the real question are laid out differently.** `A text` against `A) text`, and `N/A` padding in 21 of the 70 examples. I do not know whether that matters. In run-4, three replies named a letter past the last option (`I` on a four-option and on an eight-option question, `F` on another four-option one). The padding to ten options in the examples may play a part, but I could not tell.
7. **Two items in `docs/TaskList.md` look fixed.** Items 1 (thinking switch not sent) and 2 (split not sent) are both handled explicitly in `task_config.py` today.
8. **Pointers to a missing document.** Comments in the recipe, `Dockerfile` and `prefetch_dataset.py` cite `docs/STANDARDS_AND_PROFILES_PHASES.md`. It is not in the repo or its git history, so I could not read it.

---

## Where to look in the code

| What | Where |
|---|---|
| The recipe | `catalog/standards/mmlu_pro-v1-full.yaml` |
| Sampling profiles (default and thinking) | `catalog/sampling-profiles/greedy.yaml`, `qwen3_think.yaml` |
| Model-server settings (window, reasoning parser) | `catalog/serving-profiles/qwen3.yaml` and its siblings |
| Recipe becomes EvalScope settings | `backend/app/services/harness/task_config.py` |
| Starting the container (no timeout wrapper) | `backend/app/services/harness/runner.py` |
| Reading the report, token-limit share | `backend/app/services/harness/parser.py` |
| Dataset baked into the image, EvalScope version | `harness/evalscope/Dockerfile`, `prefetch_dataset.py` |
| Code inside the container | `harness/evalscope/run_eval.py` |
| Thinking and window checks | `backend/app/services/compatibility/rules.py` |
| Which fields are part of a recipe's identity | `backend/app/models/standard.py` |
| Per-subject results, tags, summary, 95% range | `backend/app/services/diagnostics/` (`evalscope_reviews.py`, `buckets.py`, `tags.py`, `narrate.py`, `report_summary.py`) |
| Server lifetime, output folder, harness image | `backend/app/config.py` |
| Server reuse check | `backend/app/services/endpoints/` (`lifecycle.py`, `queries.py`) |
| EvalScope's MMLU-Pro code (pinned version) | `evalscope/benchmarks/mmlu_pro/mmlu_pro_adapter.py`: prompt, examples, subject list |
| EvalScope's answer reading | `evalscope/utils/multi_choices.py`: `parse_answers` |
| EvalScope's per-subject limit and averaging | `evalscope/api/dataset/dataset.py`, `evalscope/report/report.py` |
| Real outputs | `runs/run-2`, `runs/run-4` |

---

## Sources

Opened on 3 October 2026.

- MMLU-Pro paper: https://arxiv.org/abs/2406.01574 (full text: https://arxiv.org/html/2406.01574)
- Dataset page, license, changelog and the results list: https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro
- Rows and counts, via Hugging Face's dataset viewer: https://datasets-server.huggingface.co/info?dataset=TIGER-Lab/MMLU-Pro and https://datasets-server.huggingface.co/parquet?dataset=TIGER-Lab/MMLU-Pro
- Authors' code and NeurIPS 2024 note: https://github.com/TIGER-AI-Lab/MMLU-Pro
- GPQA paper: https://arxiv.org/abs/2311.12022 (full text: https://arxiv.org/html/2311.12022)
- Qwen3 technical report (Qwen3-4B-Base, 50.58%): https://arxiv.org/abs/2505.09388 (full text: https://arxiv.org/html/2505.09388)
- Qwen3-4B-Instruct-2507 model card (58.0% and 69.6%): https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507
- EvalScope at the pinned version `2ce95c3`:
  - https://github.com/modelscope/evalscope/blob/2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85/evalscope/benchmarks/mmlu_pro/mmlu_pro_adapter.py
  - https://github.com/modelscope/evalscope/blob/2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85/evalscope/utils/multi_choices.py
  - https://github.com/modelscope/evalscope/blob/2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85/evalscope/api/dataset/dataset.py
  - https://github.com/modelscope/evalscope/blob/2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85/evalscope/report/report.py
