# What Standards and Serving Profiles Should We Add Next?

**Date:** Sep 2026
**Scope:** `evaluation-service` (what we have) vs `qvac-research-tool-call` (what the team already runs)
**Status:** Research notes. Nothing here changes code. It is a shopping list plus the reasons behind it.

This document answers three questions:

1. We have two standards today. **Which ones should we write next, and in what order?**
2. Our serving profile is a real database table with structured columns now — a different shape from anything the tool-call repo has. **Which profiles should exist in that table?**
3. What is currently **hardcoded or missing** in our code that would stop us adding those standards even if we wrote the YAML perfectly?

The third question turned out to be the important one. Several benchmarks are not blocked on writing a YAML file — they are blocked on four values that are baked into our harness builder.

---

## Table of contents

1. [Plain-English refresher](#1-plain-english-refresher)
2. [Where we are today](#2-where-we-are-today)
3. [What the tool-call repo actually runs](#3-what-the-tool-call-repo-actually-runs)
4. [Part 1 — The standards to add](#4-part-1--the-standards-to-add)
5. [Part 2 — The serving profiles to add](#5-part-2--the-serving-profiles-to-add)
6. [Part 3 — The four hardcoded values that block most of this](#6-part-3--the-four-hardcoded-values-that-block-most-of-this)
7. [Part 4 — Bigger gaps that need a decision, not just a column](#7-part-4--bigger-gaps-that-need-a-decision-not-just-a-column)
8. [Suggested order of work](#8-suggested-order-of-work)
9. [Appendix — reference tables](#9-appendix--reference-tables)

---

## 1. Plain-English refresher

Two words in this project mean very specific things, and they are easy to mix up. Worth getting straight before anything else.

**A standard** is *what test to run and how to grade it*. It is a YAML file in `standards/`. It says which benchmark, which dataset, how many examples to show the model first, what temperature to sample at, which numbers to report. Same standard + same model = same score, every time. That is the whole point of it existing.

**A serving profile** is *how to start the model's web server*. It is a row in the `serving_profile` table. It says which engine (vLLM), how many GPUs, how much of each GPU's memory to use, how long a context window to allow, and which parsers to turn on. It says nothing about which test you are running.

The split matters because **one served model can answer many tests**. Starting a model costs about 350 seconds of GPU time. If we run seven benchmarks against one running server instead of starting seven servers, we save roughly half an hour of H100 time per checkpoint. That saving only works if "how the model is served" and "what test we run" are separate things — which is exactly why we split them.

One more term you will see a lot below:

**A parser** is a small piece of vLLM that reads the model's raw text output and pulls structured pieces out of it. There are two kinds we care about. A **reasoning parser** finds the `<think>...</think>` block and moves it into its own field, so the grader scores the answer and not the model's private thinking. A **tool-call parser** finds the bit where the model says "call the weather API with city=Paris" and turns it into a proper JSON function call. Different model families write these things differently, so each family needs its own parser.

---

## 2. Where we are today

Small. Deliberately, but small.

| Thing | Count | What it is |
|---|---|---|
| Standards | **2** | `ifeval/v1-instruct`, `ifeval/v1-think` |
| Serving profiles | **1** | `qwen3` |
| Harness frameworks | **1** | EvalScope, image `registry.local/evalscope:2ce95c3` |
| Checkpoints | **1** | `Qwen3-4B-allternary-ep03` |

The two standards are the same benchmark twice — once with thinking off, once with thinking on. Layer 1 (the protocol) is byte-identical between them; only the sampling block and `enable_thinking` differ. So in benchmark terms we have **one** benchmark covered.

The single serving profile looks like this:

| Field | Value |
|---|---|
| `engine` / `engine_version` | `vllm` / `0.19.0` |
| `gpus` / `tensor_parallel_size` / `pipeline_parallel_size` | `1` / `1` / `1` |
| `max_model_len` | `32768` |
| `reasoning_parser` | `qwen3` |
| `dtype` / `quantization` | `auto` / `null` |
| `gpu_memory_utilization` | `0.85` |
| `engine_options` | `{}` |

That is the whole inventory. Everything below is about what to add to it.

---

## 3. What the tool-call repo actually runs

The tool-call team runs **20 benchmarks**, grouped into named suites. Their `core` suite — the set they say a model should be measured on before anyone looks at it — is ten benchmarks:

```
bfcl_v3, acebench, tau2_retail, tau2_telecom, tau3_banking,
mmlu_pro, gpqa_diamond, ifeval, ifbench, multi_if
```

We have **one** of those ten.

They also have `math` (gsm8k, aime25, math_500), `extended` (live_code_bench), `tool_use` (adds tool_sandbox), and a few diagnostic variants that are not in any suite (`ceval`, `acebench_fc`, `acebench_prompt`, `tau2_airline`, `tau3`).

Their whole stack runs on EvalScope, same as ours. That is the single most useful fact in this document: **we are not porting benchmarks across harnesses.** We are copying settings from one EvalScope config into another. The datasets, the graders, the metric names — all the same code underneath.

A few structural differences worth knowing, because they shape the recommendations:

- They have **no serving profile table.** How a model is served comes from a `families.yaml` file keyed by model family (qwen3, qwen3_5, lfm2, minicpm5, functiongemma). Each family is a list of vLLM flags. Our structured `serving_profile` table is genuinely new.
- Their `config_id` — the `full-ternary-04b` in the results path we quote in the IFEval standard — is **not** a serving profile. It is just a name someone typed at submit time to label a sweep. Our equivalent is `run_group.name`, not `serving_profile.label`. Worth saying out loud because the name looks profile-shaped and is not.
- Their sampling profiles (`greedy`, `qwen3_think`, `lfm2_5_think`, …) live in a model catalog, attached to a checkpoint. Ours live inside the recipe. Both are defensible; ours means a sampling change mints a new recipe row, which is the behaviour we wanted.

---

## 4. Part 1 — The standards to add

I have grouped these by **what it costs us to add them**, not by how interesting they are. The cheap ones first, because the cheap ones are how we prove the registry is not secretly hardcoded around IFEval.

### Group A — Free. Nothing new needed. (2 standards)

These need a YAML file and nothing else. Same shape as IFEval, same harness image, no new columns, no new infrastructure.

**IFBench** — AllenAI's harder instruction-following set. Reports the same four metrics as IFEval (prompt-level and instruction-level, strict and loose), uses the same kind of rule-based checkers, runs at the same batch size. It is the closest thing to a free benchmark we will ever get. In the tool-call config it does not even have a row in `benches.yaml`, because everything about it matches the defaults.

**GSM8K** — grade-school math word problems, 4-shot chain-of-thought, answer pulled out of a `\boxed{}` wrapper. Already named as benchmark number two in the plan's Milestone 2, and already flagged there as needing an explicit decision on the 4-shot-versus-convention question. Rule-scored, no judge, fast.

Both of these are `instruct` and `think` pairs, so realistically that is four YAML files. Still cheap.

> One caveat on GSM8K: it needs a real answer-extraction step, unlike IFEval where `extraction.method` is `none`. Our `extraction` column is deliberately shapeless (`extra="allow"`), so it can hold whatever EvalScope needs — but GSM8K will be the first standard that actually puts something in there, so it is worth checking the field names against a real EvalScope run rather than guessing.

### Group B — Cheap, but each needs one small unblocking change. (4 standards)

**GPQA-Diamond** — 198 hard science multiple-choice questions, 0-shot with chain-of-thought, answer choices shuffled. Small enough that the confidence interval is wide, which is exactly why the plan wants it in wave 2: it is the benchmark that forces us to settle the repeats-and-variance policy. Needs nothing new except that policy decision.

**MMLU-Pro** — 12,000 ten-choice knowledge questions, 5-shot from the validation split, answers extracted from an `ANSWER: [LETTER]` pattern. The biggest generation volume of anything on this list. Blocked on two things: our hardcoded batch size of 32 (they measured the knee at 128 and 32 leaves the GPU idle), and our fixed 12-hour SLURM time limit (they raise this one to 24 hours, and note the old stack lost a job at 49% completion by not doing so).

**AIME25** — 30 competition math problems. Thirty. You cannot read a single run of this meaningfully; it needs `repeats` and an average. We already have a `repeats` column, so that part is fine. What blocks it is the token budget: they run it at `max_tokens: 81920` with a 7200-second timeout. Both of those hit walls in our code — see [Part 3](#6-part-3--the-four-hardcoded-values-that-block-most-of-this).

**MATH-500** — same shape as AIME25, 500 problems instead of 30, same 81920-token budget and 7200-second timeout. Add it in the same change as AIME25 or not at all; separating them just means doing the same unblocking work twice.

### Group C — Real work, and worth it. (1 standard, high value)

**BFCL v3** — the tool-calling benchmark, and the reason the tool-call repo exists. Seventeen subsets covering simple calls, parallel calls, multi-turn conversations, and "irrelevance" (does the model correctly decline to call anything?). Rolled up into one `overall_acc` plus three group scores.

This is the single most valuable benchmark on the list for our team, and it is the one that most clearly does not fit the current schema. Three separate problems:

1. **Seventeen subsets.** Our harness builder writes `subset_list: ["default"]` and there is no way to say otherwise.
2. **It needs a tool-call parser.** Every family in `families.yaml` serves with `--enable-auto-tool-choice --tool-call-parser <something>`. Our serving profile has a column for the *reasoning* parser and nothing for the *tool* parser.
3. **It sets `temperature: 0.001`, not 0.** Near-greedy rather than greedy, on purpose. That one is easy — it is just a number in the YAML — but it is a good reminder that the benchmark's own definition sometimes overrides our house sampling policy, and the standard is where that gets written down and justified.

It also sets `keeps_reasoning_history: true`, which is a Layer 1 protocol choice we have nowhere to put. More on that in Part 4.

### Group D — Needs a second model running. Defer, but decide the shape now. (7+ standards)

**ACEBench** (and its `_fc` / `_prompt` variants), **the τ³ family** (`tau2_retail`, `tau2_telecom`, `tau3_banking`, `tau2_airline`), and **ToolSandbox**.

These are multi-turn conversational benchmarks. The model under test talks to a *simulated user*, and that simulated user is itself a language model. In the tool-call repo that is `user_sim.yaml`, with two flavours: `api_glm5_2` (a remote hosted GLM-5.2 endpoint) and `self_qwen3_8_27b` (a Qwen3.8-27B that gets launched on two extra GPUs inside the same job).

The plan document already saw this coming and put it well: for ACEBench the user simulator "is itself part of the standard." That is exactly right, and it is why this group is deferred rather than just difficult. **A simulator that drifts makes two models' agent scores incomparable.** If the remote GLM-5.2 endpoint silently upgrades between our January run and our March run, every agent number we published moves and we have no record of why.

So the decision to make before writing any of these standards is: does the user simulator become part of the recipe hash? I think it has to. But that is a schema conversation, not a YAML file.

**ToolSandbox** deserves a specific note: its primary metric is `similarity`, not accuracy. Everything else on this list reports something between 0 and 1 that means "fraction correct." Our `metric` table constrains `value` to 0..1, which `similarity` satisfies, so the storage is fine — but the leaderboard should not put a similarity score in the same visual column as an accuracy score without a label saying so.

### Group E — Genuinely hard. Not soon. (2 standards)

**multi_if** — 4,501 samples × 3 turns × 11 languages. Enormous. It also sets `keeps_reasoning_history: false`, the opposite of BFCL, which is what makes that field a real protocol setting rather than an engine detail. Nothing about it is conceptually hard; it is just the largest generation workload in the suite and we should not point it at a new system.

**LiveCodeBench** — executes model-generated code to see if it passes tests. The tool-call repo runs it with the sandbox turned off because there is no Docker on their compute nodes. We run our harness in a container on the control plane, which is a different security posture and needs its own think. Also pins a dataset subset (`release_v6`), which is the subset problem again.

### Not recommended

**CEval** — Chinese-language multiple choice. Fine benchmark, no row in any tool-call suite, and nothing in our roadmap says we care about Chinese-language performance. Skip until someone asks.

**`acebench_fc` / `acebench_prompt` / `tau3`** — these are diagnostic variants of benchmarks in Group D, used to compare "same benchmark through the tool channel vs the prose channel." Useful for research, not for a leaderboard. If we add them, they should be marked as non-publishable so they never produce a leaderboard row.

---

## 5. Part 2 — The serving profiles to add

Here is the thing I did not expect to find, and it is the most actionable item in this document.

### First: our one profile cannot serve a tool-calling model at all

Look at what the tool-call repo's `qwen3` family sends to vLLM:

```
--enable-auto-tool-choice --tool-call-parser hermes --reasoning-parser qwen3
```

Now look at what our `qwen3` profile renders:

```
--generation-config vllm --tensor-parallel-size 1 --pipeline-parallel-size 1
--dtype auto --gpu-memory-utilization 0.85 --max-model-len 32768
--reasoning-parser qwen3
```

**The tool-call flags are simply not there.** Without `--enable-auto-tool-choice` and a tool-call parser, vLLM returns the model's function call as ordinary text and BFCL scores zero. Our profile is fine for IFEval, which uses no tools — and IFEval is all we run today, so nothing is broken right now. But the moment we add any Group C or Group D benchmark, this profile is wrong.

There is a good escape hatch already built for exactly this: `engine_options`, a JSONB column that renders arbitrary flags. `enable-auto-tool-choice: true` and `tool-call-parser: "hermes"` are both legal there — neither is on the reserved-keys list. So we are not blocked. But see Part 4 for why I think the tool parser deserves a real column rather than living in the escape hatch forever.

### Second: our profile shares a name with something different

Our profile is called `qwen3`. The tool-call repo's family is also called `qwen3`. **They are not the same thing** — theirs includes the tool-call flags, ours does not. Anyone moving between the two repos will assume they match.

Either rename ours, or make it actually match. I lean towards making it match, since a profile that can serve tools is strictly more useful than one that cannot, and IFEval does not care either way.

### Third: nothing we own can run a `think_handling: as_is` recipe

This one is a small logical hole worth closing. The compatibility rule `as_is_needs_no_reasoning_parser` blocks any recipe with `think_handling: as_is` from running against a profile that carries a reasoning parser — correctly, because with the parser on, the think block never reaches the text the grader sees.

We have exactly one profile, and it has a reasoning parser. So **`as_is` is currently a setting the schema accepts and the system can never satisfy.** No standard uses it today, so nothing is failing, but the first person to write one will get a submit-time error with no obvious fix. A single no-parser profile closes it.

### The profiles I would add

In priority order. All of these are `engine: vllm`, `engine_version: 0.19.0` unless noted.

| # | Suggested label | What changes vs `qwen3` | Why we need it |
|---|---|---|---|
| 1 | **`qwen3-tools`** | adds `enable-auto-tool-choice: true`, `tool-call-parser: hermes` via `engine_options` | Required for BFCL, ACEBench, τ³, ToolSandbox. Nothing else can serve them. |
| 2 | **`qwen3-plain`** | `reasoning_parser: null` | Unblocks `think_handling: as_is`. One row, closes a whole hole. |
| 3 | **`qwen3-longctx`** | `max_model_len` raised to fit an 81920-token budget | Required for AIME25 and MATH-500. See the warning below. |
| 4 | **`qwen3_5`** | `tool-call-parser: qwen3_xml`, plus `language-model-only: true` and `gdn-prefill-backend: triton` | The whole Qwen3.5 catalog is served this way. Nine checkpoints in their catalog use it. |
| 5 | **`qwen3-tp2`** | `gpus: 2`, `tensor_parallel_size: 2` | Anything above ~8B, and the self-hosted 27B user simulator. Our compatibility rule already checks `gpus == tp × pp`, so the schema is ready. |
| 6 | **`lfm2`** | LFM2 tool parser plugin, `trust-remote-code: true` | Only if we start evaluating LiquidAI models. Blocked on the plugin-file problem below. |
| 7 | **`minicpm5`** | MiniCPM5 tool parser plugin | Same as above. |
| 8 | **`functiongemma`** | FunctionGemma parser plugin, **no** reasoning parser | Same as above. Also a natural second `as_is`-capable profile. |

Profiles 6, 7 and 8 all hit the same wall: they need `--tool-parser-plugin <path-to-a-python-file>`. `engine_options` can hold the path string fine, but **the file has to exist on the compute node** when vLLM starts. The tool-call repo solves this with a `${EVAL_HOME}` variable that expands to their checkout. We have no equivalent, and no story for shipping a plugin file to the cluster. That is a real piece of design work, not a config change — which is why I put those three last.

### A warning on the long-context profile

Profile 3 needs care. Our `profile_exceeds_model_context` rule refuses to start when `max_model_len` is larger than the checkpoint's own trained context length, and `Qwen3-4B-allternary-ep03`'s vLLM log shows `max_seq_len: 40960`. An 81920-token generation budget plus our 2048-token prompt allowance needs about 84k of context — roughly double what the model was trained for.

Getting there means RoPE scaling (YaRN), which is an `engine_options` entry and a quality trade-off, not just a bigger number. **I am not confident enough in the exact configuration to recommend a value here** — it should be measured against a known AIME score before we publish anything from it. Flagging it as the open question it is, rather than putting a plausible-looking number in a table.

### What we should *not* do

Do not create a profile per benchmark. The whole value of splitting profiles from recipes is that one served model answers many tests. If we end up with `qwen3-for-ifeval` and `qwen3-for-gsm8k`, we have rebuilt the coupling we deliberately took apart and thrown away the endpoint reuse saving with it.

The test for "should this be a new profile" is simple: **does vLLM need to be restarted to change it?** Tool parser, context length, GPU count — yes, new profile. Temperature, max tokens, few-shot count — no, that is the recipe.

---

## 6. Part 3 — The four hardcoded values that block most of this

This is the part I would act on first, because it is small, concrete, and it is silently blocking about eight of the standards above.

`backend/app/services/harness/task_config.py` builds the EvalScope job. Four values in it are constants that should be recipe fields:

```73:77:/home/naresh/TeamRepos/evaluation-service/backend/app/services/harness/task_config.py
        "repeats": recipe.repeats,
        "seed": 42,  # hardcoded, and inert while v1 runs greedy (temperature 0)
        "limit": recipe.sample_limit,
        "eval_batch_size": 32,
        "work_dir": container_work_dir,
```

Taking them one at a time.

**`subset_list: ["default"]`** (line 50) — the worst one. Every benchmark gets exactly one subset, always named `default`. This is correct for IFEval and completely wrong for BFCL (17 subsets), τ³ (one domain per job — that is *how* `tau2_retail` and `tau2_telecom` differ from each other), MMLU-Pro, and LiveCodeBench (which pins `release_v6`). **You cannot express `tau2_retail` at all** under the current schema, because the only thing distinguishing it from `tau2_telecom` is the subset. This needs to become a recipe field, and since it changes what is measured, it needs to be in the recipe hash.

**`eval_batch_size: 32`** (line 76) — how many requests are in flight at once. The tool-call team measured this properly and their numbers are worth copying rather than re-deriving: MMLU-Pro went from 2,179 tokens/sec at batch 32 to 3,950 at 128, and their conclusion was that at 32 the client is setting the pace and the GPU sits idle. Meanwhile ACEBench and BFCL's multi-turn subsets want *16*, because the bottleneck there is Python running in the worker process, not the endpoint.

So 32 is wrong in both directions depending on the benchmark. Note this one does **not** change what is measured, only how fast — so it should be a recipe column that stays *out* of the hash. Two runs at different batch sizes are still comparable.

**`timeout: 1800`** (line 71) — half an hour per request, where AIME25 and MATH-500 need two hours (they set 7200). If one generation outlives the client, the whole task fails, so this is not a tuning knob you can leave at a default and hope. The tool-call repo handles it with a tiered rule — 1800 normally, 3600 once the token budget passes 8192 — which is a reasonable pattern to copy, though a plain per-recipe field is simpler and I would start there.

**`seed: 42`** (line 74) — the comment says it is "inert while v1 runs greedy," which is true today and stops being true the moment we add a thinking standard with temperature 0.6. `ifeval/v1-think` already samples at 0.6. So it is arguably not inert *right now*. Low urgency, but it should be a real field before we publish any non-greedy number, because reproducibility is the entire pitch of this service.

There is also **no per-benchmark SLURM time limit.** Cluster settings live in environment variables by decision D9, which is fine for a single global default and not fine for MMLU-Pro's 24 hours. Their note on this is worth quoting because it is a real scar: they raised it "rather than tuned down, because the alternative is dying at 49% with nothing to show, which is how the old stack lost job 165026."

### Summary of the four

| Value | Line | In the hash? | Blocks |
|---|---|---|---|
| `subset_list` | 50 | **Yes** — changes what is measured | BFCL, all τ³, MMLU-Pro, LiveCodeBench |
| `eval_batch_size` | 76 | **No** — only affects speed | MMLU-Pro, ACEBench, BFCL (all mis-sized today) |
| `timeout` | 71 | No | AIME25, MATH-500 |
| `seed` | 74 | Probably yes | Reproducibility of any non-greedy run |

---

## 7. Part 4 — Bigger gaps that need a decision, not just a column

Four things that are not bugs and not quick fixes. Each needs someone to decide something.

### 7.1 The tool-call parser has no column

Our serving profile gives `reasoning_parser` a real, structured column. The tool-call parser gets nothing, and would have to live in `engine_options`.

The argument for giving it a column is the same argument that justified the reasoning parser having one. We have a compatibility rule — `strip_needs_reasoning_parser` — that catches "this recipe says strip the think block, but the profile has no parser to strip it with." That rule can only exist because the parser is a column the validator can read.

There is an exactly parallel failure waiting for tools: a BFCL recipe against a profile with no tool parser scores zero, and looks like a genuinely bad model rather than a misconfiguration. That is the worst kind of bug this service can have — a wrong number that nobody questions. Catching it needs a `tool_call_parser` column and a rule that reads it.

Given that waves 3 and 5 of the roadmap are *entirely* tool-use benchmarks, I think this column earns its place.

### 7.2 There is no home for a user simulator

Seven-plus benchmarks in Group D need a second model to play the user. Nothing in the v1 schema can hold one. The pieces needed are roughly: which model, at what URL, with what token budget for a turn, and — critically — whether it is a shared remote endpoint or a private one launched alongside the model under test.

The reason it matters for correctness rather than just plumbing: the tool-call repo's own config note says one shared instance "keeps the user's behaviour fixed across every model compared against it. That is the whole point — a simulator that drifts makes two models' agent scores incomparable." If the simulator is part of what determines a score, it belongs in the recipe hash, the same way the framework image is.

There is also a resourcing consequence. A self-hosted simulator needs two extra GPUs *added to the same job* as the model under test. Our endpoint and serve-job machinery assumes one model per job.

### 7.3 `keeps_reasoning_history` has nowhere to go

Multi-turn benchmarks have to decide whether the model sees its own thinking from the previous turn when it takes the next one. BFCL says yes, multi_if says no. That is a genuine protocol choice that changes the score, so it is Layer 1 — but `StandardDocument` has `extra="forbid"` and no such field, so a YAML that sets it is rejected outright.

It is entangled with the serving profile too, because *how* the history gets replayed depends on the family: Qwen3.5's chat template reads a `reasoning_content` field, while LFM2's ignores that field and needs the thinking inlined as `<think>` tags in the message content. So it is one recipe field plus one profile field, not one field.

Not urgent — it only bites at BFCL and beyond — but it should be designed alongside BFCL rather than bolted on after.

### 7.4 The IFEval reference score was produced under different serving conditions

Worth knowing, though not worth panicking about.

Our IFEval standard cites `prompt_level_strict = 0.7412` from tool-call run 270187. That run served the model with `--tool-call-parser hermes`, no explicit `--max-model-len` (so vLLM took 40960 from the checkpoint config), and no explicit `--gpu-memory-utilization`. Our `qwen3` profile has no tool parser, pins `max_model_len` to 32768, and sets memory utilisation to 0.85.

For IFEval specifically this almost certainly does not matter — no tools are involved, and IFEval prompts and answers are nowhere near 32k. But "the reference number was produced on a different serving configuration than the one we reproduce it with" is exactly the kind of footnote that should be written down before someone spends a day chasing a 0.5-point gap.

The cleanest fix is recommendation #1 from Part 2: make our `qwen3` profile actually match the family it is named after.

---

## 8. Suggested order of work

Roughly cheapest-and-most-unblocking first.

**Step 1 — Unblock the harness builder.** Turn `subset_list`, `eval_batch_size` and `timeout` into recipe fields; decide whether `seed` joins them. Small, self-contained, and it is the prerequisite for most of what follows. Nothing user-visible changes.

**Step 2 — Write IFBench and GSM8K.** Two benchmarks, four YAML files, no new infrastructure. This is the change that proves the registry is not quietly hardcoded around IFEval — which is the actual point of wave 1 in the plan, more than the benchmarks themselves.

**Step 3 — Fix the serving profile inventory.** Add the tool-call flags to `qwen3` (or rename it and add `qwen3-tools`), and add the no-reasoning-parser profile. Two rows. Closes the `as_is` hole and makes every tool-use benchmark downstream possible.

**Step 4 — GPQA-Diamond and MMLU-Pro.** Needs the batch size fix from step 1, plus a per-benchmark SLURM time limit for MMLU-Pro, plus the repeats-and-variance policy that GPQA forces us to write down.

**Step 5 — Decide on the tool-call parser column, then do BFCL v3.** The highest-value benchmark for this team. Do the column first so the compatibility rule exists before the first wrong-scoring run, not after.

**Step 6 — Design the user simulator.** Before writing any ACEBench or τ³ YAML. Its output is a schema decision and probably a table, not a standards file.

**Step 7 — Everything else,** in roughly the plan's existing wave order.

AIME25 and MATH-500 sit slightly outside this sequence. They are cheap once the timeout is a field, but they need the long-context profile, and that needs the RoPE scaling question answered with a measurement. Slot them in whenever someone has time to do that properly.

---

## 9. Appendix — reference tables

### 9.1 All 20 tool-call benchmarks, and what each would cost us

| Benchmark | Group | Primary metric | What blocks it today |
|---|---|---|---|
| `ifeval` | — | `prompt_level_strict` | **Already done** |
| `ifbench` | A | `prompt_level_strict` | Nothing |
| `gsm8k` | A | `accuracy` | Nothing (first real extraction step) |
| `gpqa_diamond` | B | `accuracy` | Repeats/variance policy |
| `mmlu_pro` | B | `accuracy` | Batch size; 24h SLURM limit |
| `aime25` | B | `accuracy` | Timeout; long-context profile |
| `math_500` | B | `accuracy` | Timeout; long-context profile |
| `bfcl_v3` | C | `overall_acc` | Subsets; tool parser; reasoning history |
| `acebench` | D | `overall_acc` | User simulator; per-family fc/prompt modes |
| `acebench_fc` | Not rec. | `overall_acc` | Diagnostic variant |
| `acebench_prompt` | Not rec. | `overall_acc` | Diagnostic variant |
| `tau2_retail` | D | `accuracy` | User simulator; **subsets** |
| `tau2_telecom` | D | `accuracy` | User simulator; **subsets** |
| `tau3_banking` | D | `accuracy` | User simulator; **subsets** |
| `tau2_airline` | D | `accuracy` | User simulator; **subsets** |
| `tau3` | Not rec. | `accuracy` | All three domains as one job |
| `tool_sandbox` | D | `similarity` | User simulator; non-accuracy metric |
| `multi_if` | E | `overall_avg` | Size; reasoning history |
| `live_code_bench` | E | `accuracy` (pass@1) | Code execution sandbox; subsets |
| `ceval` | Skip | `accuracy` | No stated need |

### 9.2 Serving flags used over there, and where they would live over here

| vLLM flag | tool-call families using it | Our home for it |
|---|---|---|
| `--reasoning-parser` | all except functiongemma | structured column ✅ |
| `--enable-auto-tool-choice` | all five | `engine_options` (works) |
| `--tool-call-parser` | all five | `engine_options` — **should be a column** |
| `--tool-parser-plugin` | lfm2, minicpm5, functiongemma | `engine_options` holds the path, but **nothing ships the file** |
| `--trust-remote-code` | lfm2 | `engine_options` ✅ |
| `--language-model-only` | qwen3_5 | `engine_options` ✅ |
| `--gdn-prefill-backend triton` | qwen3_5 | `engine_options` ✅ |
| `--tensor-parallel-size` | user sim (2) | structured column ✅ |
| `--max-num-seqs` | global default 128 | **no home** |
| `--default-chat-template-kwargs` (thinking) | per-model | we do this per-request in the recipe instead |

### 9.3 Their sampling profiles vs ours

They keep sampling in a model catalog; we keep it in the recipe. Their profiles map onto our Layer 2 block directly, so these are useful starting values for any new standard:

| Their profile | temp | top_p | top_k | other | max_tokens |
|---|---|---|---|---|---|
| `greedy` | 0.0 | — | — | — | 8192 |
| `qwen3_think` | 0.6 | 0.95 | 20 | — | 16384 |
| `qwen3_5_think` | 1.0 | 0.95 | 20 | presence_penalty 1.5 | 32768 |
| `lfm2_5_think` | 0.6 | 0.95 | 20 | — | 16384 |
| `lfm2_5_2_6b` | 0.1 | — | 50 | repetition_penalty 1.1 | 16384 |
| `minicpm5_instruct` | 0.7 | 0.95 | — | — | 8192 |
| `minicpm5_think` | 0.9 | 0.95 | — | — | 16384 |

Our two IFEval standards already match `greedy` and `qwen3_think` exactly, which is a good sign — it means we copied the right thing the first time.

Note the `presence_penalty: 1.5` on `qwen3_5_think`. Their comment explains it curbs a repetition loop the small models fall into, and that it is "what makes generation terminate at all" — a real constraint rather than a preference. Good news: our harness builder does forward `presence_penalty` to EvalScope, so that setting would work as intended if we ever evaluate a Qwen3.5 thinking model.

Worth clearing up a related point, because the comment column in our IFEval YAML reads ambiguously if you skim it. **Decision D4 is about `min_p` and only `min_p`** — it is the sole entry in `FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS`, because EvalScope's `openai_api` path drops it silently. The neighbouring `presence_penalty: 0.0` in our standards is just our own neutral default, not a D4 restriction. And none of their seven sampling profiles sets a non-zero `min_p`, so adopting any of them would not trip the D4 warning at all.
