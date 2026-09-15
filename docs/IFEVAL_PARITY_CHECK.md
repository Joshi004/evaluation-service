# Why our IFEval score doesn't match the tool-call team's

**Date:** 15 Sep 2026
**What this is:** we ran IFEval on the same model checkpoint the tool-call team ran it on, and got a higher score. This explains why.

**The runs being compared:**

- Tool-call team, run `267735`, 25 Aug 2026
- Us, run `run-10`, 15 Sep 2026
- Same checkpoint both times: `.../249740_q35-rlmixv8a-...-s810/merged_global_step_810`

**The numbers:**

| Score | Tool-call | Us | Difference |
|---|---|---|---|
| prompt_level_strict (the headline one) | 85.40% | 88.7% | we're 3.3 points higher |
| prompt_level_loose | 87.62% | 91.1% | we're 3.5 points higher |
| inst_level_strict | 90.63% | 93.2% | we're 2.6 points higher |
| inst_level_loose | 92.42% | 95.1% | we're 2.7 points higher |

---

## The short answer

**We are running the same test. We are running the model differently.**

Both systems asked the model the same 541 questions and graded the answers with the same grader. Nothing about the test itself is different — we checked that carefully and it holds up.

What's different is how the model was *started up* on the GPU. Two settings the tool-call team uses, we don't. And once you account for those, a gap this size is completely unremarkable — it's 18 questions out of 541.

So: not a bug in the grading, not a different benchmark, not a different model. A difference in how the model was served, plus normal luck.

---

## First, the thing that trips everyone up

This model doesn't answer questions the same way twice.

The sampling settings both teams use on purpose include `temperature: 1.0`. In plain terms, temperature is how much randomness the model is allowed when picking its next word. At 1.0 it's picking fairly freely — it is *supposed* to give you a different answer each time you ask.

That matters enormously for IFEval specifically, because IFEval doesn't grade whether an answer is *good*. It grades whether the answer obeys a mechanical rule: "write exactly three paragraphs", "don't use any commas", "reply in all lowercase", "end with this exact sentence". One extra word, and "exactly three paragraphs" fails. One stray comma, and "no commas" fails.

So the same model, asked the same question twice, can pass one time and fail the next — without anything being wrong.

**This is not a small effect.** Looking at the tool-call run's own results, the rules the model is worst at are exactly the ones a slightly different answer flips:

| Type of rule | How often the model got it right |
|---|---|
| combination (e.g. "give two answers separated by ***") | 66% |
| length_constraints (word, sentence, paragraph counts) | 73% |
| punctuation (e.g. "no commas") | 79% |
| keywords (must/mustn't include certain words) | 82% |
| everything else | 88–90% |

A third of the "combination" rules were already failing. Those are the ones sitting right on the edge.

---

## What's actually different between the two runs

### 1. Their run always rolls the same dice. Ours rolls fresh dice every time.

This is the big one.

When you start the model server, you can hand it a fixed starting number for its randomness — a "seed". Give it the same seed and it makes the same random choices, so you get byte-for-byte the same answers every time. Leave it out and it makes fresh random choices on every run.

The tool-call team passes `--seed 42` to the model server. We don't.

It looks like we do, which is the confusing part. Our serving profile has `seed: 42` in it, and the run page displays it. But following where that number actually goes:

- It lands in the harness's own config, where it's used to decide what order to read the dataset in.
- It never reaches the model server, because the code that builds the server's command line (`render_engine_args`) doesn't have a line for it.
- And the harness doesn't put it in the individual requests either — that's a separate field in the harness that defaults to empty, and nothing fills it in.

So their run is repeatable and ours isn't. Two runs of ours, back to back, would not give the same score either.

**This is worth fixing regardless of the parity question.** Right now no number this service produces can be reproduced, even by itself.

### 2. A chunk of the model is doing its maths with a different routine.

This model is unusual inside. Most models are built from one kind of layer repeated over and over. This one mixes two kinds: 18 layers of one sort and 6 of another, alternating.

For the 18 unusual layers, the serving software offers a choice of maths routine. The tool-call team explicitly picks one (`--gdn-prefill-backend triton`). We don't pick, so we get the default, which is a different one.

Both routines compute the same thing in theory. In practice they add up floating-point numbers in a different order, so the results differ in the last few decimal places. Normally that's invisible. But it nudges the model's word choices, and as established above, a nudged word choice on this benchmark can flip a pass into a fail.

The tool-call team's own note next to that setting says they chose it because it's *reproducible* and the default one has caused them problems. Worth reading before we decide we know better.

### 3. We're loading the image-understanding half of the model for no reason.

This checkpoint can handle images as well as text. IFEval is text only.

The tool-call team tells the server "text only, skip the image part" (`--language-model-only`). We don't, so we load the whole thing.

For text-only questions this *should* produce identical answers. I'd expect this to contribute little or nothing — but I haven't proven it, so I'm listing it rather than dismissing it.

### 4. We're batching the work differently.

They cap the server at 128 questions in flight and give it more GPU memory; we don't set the cap and give it slightly less. This changes how many questions get processed together, which again changes the order things get added up, which again nudges word choices slightly.

Smallest of the four. Listed for completeness.

---

## All four of those come from one mistake

The run used a serving profile called `qwen3.5-40960`. That profile is set up for the *plain text* Qwen3 models, not for this one — you can tell because it carries a setting called `tool-call-parser: hermes`, which belongs to the other family.

The tool-call team's config file has a purpose-built entry for this model family with all four settings on it. We used the wrong neighbour's recipe.

Two other things about that profile are worth flagging:

- The `hermes` setting is genuinely wrong for this model. It can't affect IFEval, because IFEval never asks the model to call a tool, so that setting never gets used. But it *will* silently break BFCL, ACEBench and the τ² benchmarks the moment those are added.
- The profile isn't in `catalog/serving-profiles/` at all. It was created straight into the database, so nobody reviewed it and it isn't in version control. That's a gap in the process, not just in this one profile.

---

## Things I suspected and checked, that turned out to be fine

Writing these down because the "it's all fine" half is the more useful half — it means the two systems genuinely agree about what IFEval *is*.

**Was one run's answers getting cut off?** This was my main suspect. If the model runs out of room mid-answer, the answer gets thrown away half-finished and scores zero — and a handful of those would explain the whole gap.

It's not that. I opened the tool-call run's 541 saved answers and checked every one: all 541 finished normally, none were empty, and the longest was 7,963 words' worth of output against a budget of 32,768. Nowhere near the limit. Our run independently reported 0% cut off. So both runs are clean, and the difference in the memory limits we set (40,960 vs 262,144) doesn't matter either, because nothing got close to either number.

**Same questions?** Yes. Same dataset, same source, 541 questions on both sides.

**Same grader?** Yes. Same pinned version of EvalScope. The tool-call team applies four patches to it, and I read all four — they change ACEBench, ToolSandbox, and two package version pins. None of them touch IFEval.

**Same serving software version?** Yes, v0.19.0 on both. I read it out of their run's own server log rather than assuming.

**Same sampling settings?** Yes, identical: temperature 1.0, top_p 0.95, top_k 20, presence_penalty 1.5, max_tokens 32,768.

**Was "thinking mode" on in both?** Yes. The two systems turn it on in different places — they set it when the server starts, we set it on each individual request — but the effect is the same. And both strip the thinking out before grading, via the same mechanism.

**`--generation-config vllm`, which only we pass.** I worried this was changing something underneath us. It isn't. I read the serving software's source: that flag only affects six specific settings, and this checkpoint's config file doesn't contain any of them. It does nothing here.

**`reasoning_history`, which is set differently.** Also does nothing here. I read the grader's source: that setting only controls how a *previous* answer gets re-sent to the model in a multi-turn conversation. IFEval is one question, one answer. There's no previous turn for it to act on.

---

## Is 3.3 points actually a lot?

No. And this is the part most worth internalising.

**In whole questions:** 541 questions, so one question is worth 0.185 points. Our run got 480 right, theirs got 462. The entire gap is **18 questions**.

**How much wobble is normal:** with 541 questions and a score around 87%, any single IFEval number carries an uncertainty of roughly **plus or minus 2.8 points** just from which questions happened to be in the test set. That's the honest error bar on one run.

**How unusual is a 3.3-point gap:** if both runs were measuring the exact same true ability and differed only by luck, you'd see a gap this big or bigger roughly **one time in nine**. That's not a rare event. It's not evidence that something is broken.

One caveat, to be fair to the other reading: all four metrics moved the same direction. That *looks* like four pieces of evidence, but it isn't — all four are computed from the same 541 answers, so it's really one observation counted four times.

**The practical takeaway:** this is exactly the case for adding an error bar (`stderr`) to the `metric` table, which `CURRENT_STATE_ANALYSIS.md` already flags as missing. Without it, the leaderboard will keep showing gaps of this size as if they were real rankings. Two models three points apart on IFEval are, as far as this benchmark can tell, tied.

---

## What to do about it

**1. Pass the seed through to the model server.** One line in `render_engine_args`. Until this is done, nothing this service produces is reproducible, including against itself. Do this first.

**2. Write a proper serving profile for this model family.** Copy the tool-call team's existing entry rather than inventing one: `--language-model-only`, `--gdn-prefill-backend triton`, `--tool-call-parser qwen3_xml`, `--max-num-seqs 128`. Put it in `catalog/serving-profiles/` so it's in version control and reviewable, unlike the one that was used.

**3. Then compare the answers, not the scores.** Once the settings match, put our 541 saved answers next to theirs and look at which specific questions changed. This is the test that settles it: if the changes are scattered across all the rule types, it's luck. If they pile up in one rule type, something is still genuinely different.

I couldn't do this step. Our run's saved answers live in a directory that isn't on this machine, and the container system isn't reachable from here either. Copy that file somewhere accessible and this takes minutes.

**4. Stop comparing single runs.** Run it three to five times on each side and compare the averages with error bars. At this benchmark's size and this temperature, one number against one number can't settle parity in either direction — not even if they match.

---

## In one paragraph

We and the tool-call team are running the same IFEval on the same model. The test, the questions, the grader, and the sampling settings all match, and I checked each one against the actual files rather than the config names. What doesn't match is how the model was started on the GPU: we left out the fixed random seed, so our answers aren't repeatable, and we left out a setting that controls which maths routine runs on most of this model's layers. Both omissions come from using a serving profile built for a different model family — one that also isn't in version control. The resulting 3.3-point gap is 18 questions out of 541, which is well inside this benchmark's normal wobble, so nothing here is alarming. But it does mean neither number should be published as authoritative yet, and that the service needs an error bar on its metrics before anyone treats its leaderboard as a ranking.
