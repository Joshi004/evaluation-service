# Standards, Sampling Profiles and Serving Profiles — What to Add and How to Shape It

**Date:** Sep 2026
**Scope:** `evaluation-service` compared against all five team repos — `qvac-research-tool-call`, `qvac-research-medpsy`, `qvac-research-one-bit-models`, `tether_VLMEvalKit`, `qvac-visionpsy-nano`
**Status:** Research notes. Nothing here changes code.

This started as a shopping list of benchmarks to add. Looking at the other four teams turned it into something bigger: a proposal to change the shape of a recipe, a finding that one concept we filed as tool-team-specific is needed by every team, and a measured answer to how much disk all of this needs.

**How to read this.** We are building one service for every team, but we start with the tool team. So each section is split the same way:

> **Tool team — build now.** What we need for the benchmarks we are adding first.
>
> **Other teams — don't block.** What the same section must leave room for, without building it yet.

If you only care about the next month of work, read the "build now" halves.

---

## Table of contents

1. [Plain-English refresher, including what sampling actually is](#1-plain-english-refresher-including-what-sampling-actually-is)
2. [Where we are today](#2-where-we-are-today)
3. [The five repos in one picture](#3-the-five-repos-in-one-picture)
4. [Can every team use one hosted-model architecture?](#4-can-every-team-use-one-hosted-model-architecture)
5. [Shape change 1 — split the recipe in two](#5-shape-change-1--split-the-recipe-in-two)
6. [Shape change 2 — the second model deserves its own table](#6-shape-change-2--the-second-model-deserves-its-own-table)
7. [Shape change 3 — when to use a column and when to use JSON](#7-shape-change-3--when-to-use-a-column-and-when-to-use-json)
8. [One benchmark, one harness](#8-one-benchmark-one-harness)
9. [Where the datasets live, and what they weigh](#9-where-the-datasets-live-and-what-they-weigh)
10. [The standards to add](#10-the-standards-to-add)
11. [The serving profiles to add](#11-the-serving-profiles-to-add)
12. [Fitting Groups C, D and E into the new shape](#12-fitting-groups-c-d-and-e-into-the-new-shape)
13. [The four hardcoded values](#13-the-four-hardcoded-values)
14. [What still breaks](#14-what-still-breaks)
15. [Suggested order of work](#15-suggested-order-of-work)
16. [Appendix — reference tables](#16-appendix--reference-tables)

---

## 1. Plain-English refresher, including what sampling actually is

### What sampling is

A language model does not pick the next word. It produces a **score for every possible next token** — thousands of them — and then something has to choose one. **Sampling is that choosing rule.** It is the difference between a model that gives you the same answer every time and one that gives you a different answer every time.

The knobs, in plain terms:

| Knob | What it does | Plain analogy |
|---|---|---|
| **temperature** | flattens or sharpens the odds. `0` = always take the single most likely token. Higher = more willing to take a less likely one | how adventurous the model is |
| **top_p** | only consider the most likely tokens that together make up this much of the probability, e.g. `0.95` | ignore the bottom 5% of the tail |
| **top_k** | only consider this many candidates, e.g. `20` | only ever look at the top 20 options |
| **min_p** | drop anything less likely than this fraction of the best option | another way to cut the tail |
| **presence_penalty** / **repetition_penalty** | push down tokens the model has already used | stops it looping on the same phrase |
| **max_tokens** | how long the answer may be before it is cut off | the word limit |

**Temperature 0 is called "greedy"** — no randomness at all, same answer every time, which sounds ideal for a benchmark. It is not always ideal, and that is the whole reason sampling has to be configurable. Qwen's own guidance for their thinking models is temperature 0.6, and they explicitly warn that greedy decoding makes those models repeat themselves and degenerate. If we forced greedy on a reasoning model we would publish a bad number, the owning team would correctly reject it, and the leaderboard would lose its credibility.

So: **sampling changes the score, and the right setting depends on the model, not on the test.** That single sentence is the argument for Section 5.

### The other four words

**A standard** is *what test to run and how to grade it*. Which dataset, how many worked examples to show first, how to pull the answer out, which numbers to report. Identical for every model — that is what makes two scores comparable.

**A sampling profile** is *how we ask the model to speak* — the settings above, gathered under a name like `greedy` or `qwen3_think`.

**A serving profile** is *how we start the model's server*. Engine, GPUs, context window, which parsers are switched on. Nothing about which test is running, which is the point: one running server can answer many tests.

**An auxiliary model** is *a second model that takes part in producing the score* — a judge that grades an answer, or a simulated user that holds up the other end of a conversation. Section 6.

**Execution mode** is *how the harness reaches the model*: over HTTP to a running server, or loaded inside the harness process. Section 4.

---

## 2. Where we are today

| Thing | Count | What it is |
|---|---|---|
| Standards | **2** | `ifeval/v1-instruct`, `ifeval/v1-think` |
| Serving profiles | **1** | `qwen3` |
| Harness frameworks | **1** | EvalScope, image `registry.local/evalscope:2ce95c3` |
| Checkpoints | **1** | `Qwen3-4B-allternary-ep03` |

Our two standards are the same benchmark twice — thinking off, thinking on. Layer 1 is byte-identical; only sampling and `enable_thinking` differ. So we have **one** benchmark covered, and we have already paid the cost of duplicating an entire file to change six numbers. That is a preview of Section 5.

| Field | `qwen3` profile |
|---|---|
| `engine` / `engine_version` | `vllm` / `0.19.0` |
| `gpus` / `tensor_parallel_size` / `pipeline_parallel_size` | `1` / `1` / `1` |
| `max_model_len` | `32768` |
| `reasoning_parser` | `qwen3` |
| `dtype` / `quantization` | `auto` / `null` |
| `gpu_memory_utilization` | `0.85` |
| `engine_options` | `{}` |

---

## 3. The five repos in one picture

| | tool-call | medpsy | one-bit-models | VLMEvalKit | visionpsy-nano |
|---|---|---|---|---|---|
| **Harness** | EvalScope | OpenCompass fork | lm-eval 0.4.12 | VLMEvalKit fork | none (model repo) |
| **How the model is reached** | vLLM over HTTP | vLLM over HTTP | **both** — see Section 4 | vLLM HTTP **pool** | vLLM HTTP, or llama.cpp CLI |
| **Needs a second model?** | **Yes** — user simulator | **Yes** — judge | **Yes** — judge *and* simulator | **Yes** — judge | n/a |
| **Runs an endpoint pool?** | No | No | **Yes** — 8 judge replicas | **Yes** — one per GPU | No |
| **Sampling lives where?** | model catalog | model profile | manifest / role config | model registration | script defaults |
| **Sampling inside the benchmark?** | only where mandated | no | no | no | n/a |
| **Benchmarks** | 20 | 18 | 18 + newer work | 61 units | none |

Three things follow, and they are Sections 4, 6 and 8.

**Nobody puts temperature inside a benchmark definition.** All four harnesses keep sampling in a model-shaped place and let a benchmark override individual keys only where its published definition demands it. We are the only one that bakes the whole sampling block into the benchmark recipe.

**Every team that evaluates needs a second model.** Four out of four. This was three out of four until I looked at the low-bit team's newer branches.

**Two teams run pools of endpoints, not single endpoints.** Also newly discovered on the low-bit side.

---

## 4. Can every team use one hosted-model architecture?

Short answer: **yes, and the low-bit team has largely done it already.** The concern was well-founded but the situation has moved.

### What the low-bit repo looked like

The `eval` branch — last touched 29 June — is the in-process harness. Every run is `python -m lm_eval --model vllm --model_args "pretrained=...,dtype=bfloat16,data_parallel_size=8,..."`. No server, no URL, no port. That is genuinely incompatible with our design, which assumes an OpenAI-compatible endpoint.

### What it looks like now

Their newer branches tell a different story. On `ternary-qat-rl`, last touched 3 September, the team's own scripts start OpenAI-compatible vLLM servers:

- `judge/serve_judge_fleet.sbatch` starts **eight replicas of Qwen3.5-27B**, one per GPU, each a `vllm.entrypoints.openai.api_server` on its own port, and writes the live URLs to an `endpoints.txt` that downstream jobs read.
- `eval/tau_slice_*.sbatch` serve the model under test **and a Qwen3.6-27B user simulator at tensor-parallel 2**, with `--enable-auto-tool-choice --tool-call-parser qwen3_coder --reasoning-parser qwen3` and thinking switched off. That is nearly identical to the tool-call team's own simulator recipe.
- `eval/mtbench_run.py` runs MT-Bench with judging by `gpt-oss-120b` over a hosted inference API.

And on `qwen3-Agent-repro`, the model config opens with a line that could have been written for this document:

> `# Role -> endpoint mapping. Every model role is an OpenAI-compatible chat endpoint.`

with four roles — policy, synthesizer, simulator, judge — each carrying a `base_url`, a `model`, and its own sampling block. That is independently the design proposed in Section 6, arrived at by another team for their own reasons.

### Is the remaining migration feasible?

Yes, and it is smaller than it looks. lm-eval already ships OpenAI-compatible model types; I confirmed against the exact version they pin (0.4.12) that it registers both `local-completions` and `local-chat-completions`. Moving a task from in-process to hosted is a change of the `--model` flag and the `model_args` string, not a rewrite of the harness.

Three real costs, worth naming honestly:

1. **Re-baselining.** In-process and served vLLM are not guaranteed to produce identical numbers — batching, padding and tokenizer handling differ. Any benchmark that switches has to be re-run before its history is trusted. That is a cost of the move, not an argument against it.
2. **Their eight-way data parallelism.** `data_parallel_size=8` inside one lm-eval process becomes eight served replicas plus a client that spreads work across them — which is exactly the judge fleet they already built, so the pattern exists in their own code.
3. **Quantization stays a checkpoint property.** Their ternary weights are materialized to bfloat16 *before* evaluation, so vLLM loads them with `quantization=None`. Hosting changes nothing here, but see Section 14.3 for why that is still worth recording carefully.

> **Tool team — build now.** Nothing. The tool team is already the hosted case.
>
> **Other teams — don't block.** Treat hosted-over-HTTP as the one supported execution mode and say so plainly, because the evidence now supports it: four of the five repos already serve models over an OpenAI-compatible endpoint. The genuine exception is VisionPsy's llama.cpp path, which builds only `llama-mtmd-cli` and never `llama-server`, so it has no HTTP endpoint at all — and its model is *two* GGUF files at different quantizations, controlled by offloaded-layer counts rather than a memory fraction. That one is an edge case to decide on deliberately, not a reason to support two execution modes everywhere.

---

## 5. Shape change 1 — split the recipe in two

### The proposal

Today one `recipe` row holds both the protocol and the sampling, under one hash. Split it:

| New thing | Holds | Changes when |
|---|---|---|
| **`standard`** | benchmark, framework, dataset, split, subsets, few-shot, prompt, extraction, metrics, repeats — plus the sampling the benchmark's own definition *mandates* | we change what the test is |
| **`sampling_profile`** | temperature, top_p, top_k, min_p, penalties, max_tokens, enable_thinking | we change how we ask the model to speak |
| **`serving_profile`** | engine and its flags | we change how the server is started |

### This is not a new idea — it is the original plan

`EVAL_SERVICE_PLAN.md` Section 5 already specifies exactly this: Layer 1 is the protocol, Layer 2 is "the run profile," and the data model at line 509 has a `model_profile` table next to `recipe`. V1 deliberately folded Layer 2 into the recipe hash as a simplification, and `DATA_MODEL_V1.md` Section 8 records it as a known simplification rather than a decision that Layer 2 does not exist.

So this is **un-simplifying something we simplified on purpose**, now that we know more. Much smaller argument than proposing a new architecture.

### Why it is worth doing

**Every other team already works this way.** Four out of four, and not by coincidence — sampling is a property of the checkpoint, not of the test.

**The duplication is visible at two standards.** Multiply by twenty benchmarks and we maintain forty files restating the same handful of sampling blocks. Change our greedy policy and we edit twenty of them; any one we miss is a silently wrong number.

**It makes the auxiliary model expressible.** A judge or simulator is described by exactly three things: which model, how it samples, how it is served. If sampling has no independent existence, there is nowhere to record "the judge runs at temperature 0.01" except glued into a benchmark recipe. Section 6 depends on this.

### The part that must not get lost

One hash covering everything is what guarantees comparability today. Split it and you can accidentally put two IFEval scores side by side that were taken at different temperatures.

The plan already solved this and the solution has to come back with the split: **every run stores a resolved composite hash**, computed from the values actually used, not the ones requested. The leaderboard groups by it. Two rows may only share a ranking if they share it. Pair it with the recorded choice, so a resolution bug shows up as a hash mismatch rather than a wrong number wearing the right label.

**Open question worth deciding explicitly:** does the *serving* profile go into that hash, or only standard and sampling? The plan says only standard and sampling. But serving choices can move a score — a different KV-cache precision, for instance. For the low-bit team the quantization is baked into the checkpoint, so checkpoint identity covers it; for a profile that quantizes at serve time it would not. Settle this before the split ships.

### The three-layer resolution order

Splitting sampling out does not mean the standard has no say. Some sampling is mandated by the benchmark: BFCL specifies near-greedy `temperature: 0.001`, AIME25 needs an 81,920-token budget or the problems do not fit. Those are protocol, not preference.

The tool-call repo has the right precedence and even the right warning — its `sampling_overrides` key is documented as "for what the benchmark's definition requires, not for what is fast." Copy it:

```
sampling profile (from the checkpoint)
  ← overridden by → standard's mandated overrides (from the benchmark)
    ← overridden by → what the user typed at submit time
```

Resolve those three, store the result, hash the result.

> **Tool team — build now.** Two tables instead of one, three-layer resolution, composite hash on the run. About seven named sampling profiles, liftable straight from the tool-call catalog (Appendix 16.3).
>
> **Other teams — don't block.** Medpsy resolves the same way with one wrinkle: a non-empty `generation_kwargs` block *replaces* the inherited one rather than merging key by key. If we choose merge semantics — and we should, since that is what tool-call does and what the order above implies — write that difference down rather than discover it. VLMEvalKit's board policy is the simplest of anyone's: greedy everywhere, deliberately, so vision scores stay reproducible. One more named profile.

---

## 6. Shape change 2 — the second model deserves its own table

### Four teams, three names, one concept

| Team | What they call it | Which model | How it is served |
|---|---|---|---|
| tool-call | user simulator | GLM-5.2 (remote), or Qwen3.8-27B | second vLLM in the same job, +2 GPUs |
| medpsy | judge | CompassJudger-2-32B, gpt-oss-20b, Gemma4_31B | second vLLM, eval phase only |
| **one-bit-models** | **judge + user simulator** | **Qwen3.5-27B ×8, gpt-oss-120b, Qwen3.6-27B** | **8-replica fleet; simulator at TP=2** |
| VLMEvalKit | judge | Qwen3.6-27B-FP8, aliased `gpt-4o-mini` | one replica per freed GPU |

I had this filed as a tool-team problem for ACEBench. It is not. **Every team that evaluates needs a second model,** for the same structural reason: the score is not a function of the model's output alone. Something else must read that output or talk back to it, and that something becomes part of the measurement.

### Does it change the number? Yes, and everyone knows it

The tool-call config says a shared simulator "keeps the user's behaviour fixed across every model compared against it. That is the whole point — a simulator that drifts makes two models' agent scores incomparable."

VLMEvalKit makes it a hard failure, having removed upstream's silent fallback to exact-match scoring when the judge is unreachable:

```284:289:/home/naresh/TeamRepos/tether_VLMEvalKit/vlmeval/dataset/image_mcq.py
            if not model.working():
                raise RuntimeError(
                    'Judge endpoint is not working. Refusing to fall back to exact matching '
                    'so every recorded score is judge-backed; re-run when the judge is up.\n'
                    + DEBUG_MESSAGE
                )
```

They would rather lose the run than record a number produced a different way — the same instinct as our recipe hash, expressed as an exception.

The judge's own sampling matters too: medpsy runs it at 0.01 for generic grading, 0.5 for HealthBench rubrics, 0 for arena judging. Three temperatures for three grading jobs, all deliberate.

**So the auxiliary model's identity and sampling belong in the standard's comparison hash.** Not in the serving profile, not in a free-text note.

### Should it be its own table? Yes

The alternative is a JSON field on the standard. A table is better, for six reasons — and the first three are the ones that actually decide it.

1. **The recall query.** When a judge turns out to be broken or to have drifted, the question is "which published scores did it produce?" With a table and a foreign key that is an indexed join. With JSON it is a scan across every standard, with nothing enforcing that the same judge is even spelled the same way twice.
2. **It needs foreign keys of its own.** An auxiliary model points at a sampling profile and a serving profile. You cannot put a foreign key inside a JSON blob and have the database enforce it — and if the judge's serving config is not a real `serving_profile` row, we have two ways of describing how to serve a model and they will drift.
3. **It is shared, not per-benchmark.** Medpsy binds one judge per *suite*, covering many benchmarks. The low-bit team runs eight replicas of a single judge. Many standards point at few judges — the textbook case for normalising rather than copying.
4. **The alias problem.** VLMEvalKit serves Qwen3.6-27B-FP8 under the name `gpt-4o-mini`, and the low-bit team's judge names differ from the weights behind them. The recorded label and the actual weights are two different facts and both must be stored. A row holds both; a JSON string tends to hold one, and it is usually the wrong one.
5. **It has its own lifecycle** — versioned, replaced, deprecated, independent of any benchmark.
6. **A run can need more than one.** Medpsy's cascade evaluator uses a judge to *extract* an answer and then rule-scores it, separately from the judge that *grades*. Two auxiliary models, two roles, one run. A table plus a role column handles that; a JSON field starts nesting.

This is the same argument that made `serving_profile` a table rather than a blob on the checkpoint, so it is consistent with a decision we already made and are happy with.

**One rule to carry over:** hash the auxiliary model by its *content* — model identity, sampling, serving — not by its row id. Otherwise recreating an identical judge under a new id silently changes every hash that references it. Same content-addressing rule as `serving_profile`.

### The shape it wants

Section 5 has to come first, because once sampling is its own thing the auxiliary model needs no new vocabulary:

| | Model under test | Auxiliary model |
|---|---|---|
| which weights | `checkpoint` | `checkpoint`, or a remote endpoint |
| how it speaks | `sampling_profile` | `sampling_profile` |
| how it is served | `serving_profile` | `serving_profile` |

The only genuinely new fields are the **role** it plays (`judge`, `user_simulator`, `extractor`) and, for the remote case, a URL plus the *name of the environment variable* holding the key — never the key itself, since these configs are committed.

### The one hard part

Not the schema — the GPUs. A self-hosted auxiliary model needs hardware at the same time as the model under test, and the four teams solve it four ways: tool-call adds 2 GPUs to the job, medpsy starts the judge for the eval phase only, VLMEvalKit waits for inference to finish and reuses the freed GPUs, the low-bit team runs a standing eight-replica fleet and passes URLs around in a file. Our serve-job machinery assumes one model per job.

> **Tool team — build now.** Nothing. Groups A, B and C all work without a second model. But design the standard so the fields have somewhere to go, because ACEBench and τ³ need all of it at once.
>
> **Other teams — don't block.** Medpsy needs this on day one — most of their suites are judge-scored and the judge is chosen per suite. VLMEvalKit and the low-bit team both need replica counts, because both run fleets. And the alias problem is not cosmetic: if we record only `gpt-4o-mini` we will publish scores whose grader we cannot identify afterwards.

---

## 7. Shape change 3 — when to use a column and when to use JSON

The rule — **team-specific settings go in JSON, universal ones get a column** — is right. Here is the sharper version.

### The rule, stated precisely

A field earns a column when **both** are true:

1. **More than one team needs it.** Otherwise every team's pet flag becomes a migration and the table grows forever.
2. **The service itself must read it** to make a decision: validate a combination, recommend a profile, decide two runs can share an endpoint.

Everything else goes in JSON.

### We already do this

The `extraction` field is a shapeless JSON object with `extra="allow"`, and it **is** in the recipe hash. So "hashed JSON blob for the parts that vary per benchmark" is already established, tested and shipping. Not a new mechanism — an existing one applied more widely.

### Applying it — and changing my earlier recommendation

Last time I argued the tool-call parser deserved a column. Having seen the other four teams, **that was wrong and the JSON-first instinct is right.**

Only one team needs it. Medpsy touches tool calling through a thin overlay borrowing the tool-call repo's own runner; the vision teams have no use for it. A column would be one team's flag promoted into everybody's schema — exactly what the rule prevents.

My original worry stands: a BFCL run against a profile with no tool parser scores zero and looks like a bad model rather than a broken setup. But that is satisfied more cheaply than by a column — **an agreed key name inside `engine_options`, plus a validation rule that reads it.** The validator does not care whether it reads `profile.tool_call_parser` or `profile.engine_options["tool-call-parser"]`; it needs an agreed spelling. Agree the spelling, write the rule, skip the migration.

Worth noticing the table already breaks the rule the other way. `gpu_memory_utilization` is NOT NULL, and llama.cpp has no such concept — it controls GPU use by counting offloaded layers. So we already have a vLLM-specific setting as a universal column. Not urgent, but "our columns are the universal ones" is not true today.

### Where each disputed field lands

| Field | Column or JSON | Why |
|---|---|---|
| `engine`, `engine_version` | **column** | every team; endpoint reuse depends on it |
| `max_model_len` / context size | **column** | every engine has one; we validate against it |
| `dtype`, `quantization` | **column** | every team; the low-bit team exists because of it |
| `tensor_parallel_size`, `gpus` | **column** | universal; we already validate they agree |
| `reasoning_parser` | **column** | four teams; two compatibility rules read it |
| **`tool_call_parser`** | **JSON, agreed key** | one team — but validated, see above |
| `subsets` | **column** | every single team subsets something |
| `eval_batch_size`, `timeout`, `seed` | **column, not hashed** | universal and operational |
| `chat_template` | JSON | a path, not a decision we validate |
| `downsample_mode`, `max_pixels`, `min_pixels` | JSON | vision only |
| `mmproj` path, `n_gpu_layers`, `mtmd_no_upscale` | JSON | llama.cpp only |
| `kv_cache_dtype` | JSON | one team so far |
| ACEBench `family_modes`, τ³ `retrieval_config`, `max_dialog_turns` | **JSON, hashed** | one benchmark each, but they change the score |

### The distinction that actually decides things

Two JSON fields, not one, because they are hashed differently:

- **Does it change the number when everything is working correctly?** → belongs to the **standard**; its JSON goes **in the hash**. ACEBench's per-family scoring mode, τ³'s retrieval setting.
- **Does it decide whether it works at all?** → belongs to **serving**, gets **validated**, stays out of the hash. The tool parser, the vision plugin path, the offloaded-layer count.

That answers "where do the tool parser and the user simulator belong." They feel similar — both fiddly, both needed for tool benchmarks — but they are opposites. Without a tool parser, BFCL does not produce a wrong number, it produces a broken one. With a different judge, ACEBench produces a perfectly valid number that simply is not comparable to yesterday's.

> **Tool team — build now.** One hashed JSON field on the standard; keep `engine_options` for engine flags, with agreed key names for the ones we validate.
>
> **Other teams — don't block.** The same two JSON fields absorb almost everything the other teams need, which is the main evidence the rule is right. Vision pixel caps, judge chat templates, GGUF paths, KV-cache precision — engine-side JSON. Judge identity and rubric version — the auxiliary table from Section 6. What genuinely will not fit is in Section 14.

---

## 8. One benchmark, one harness

Requiring that each benchmark belongs to exactly one framework is the right rule. Otherwise two teams both publish "IFEval 74" and the numbers are not the same measurement. Here is where the rule bites today.

### The collisions

| Benchmark | Teams | Harnesses | Same measurement? |
|---|---|---|---|
| **IFEval** | tool-call, medpsy, one-bit | EvalScope / lm-eval / lm-eval | **No — three-way, two harnesses** |
| **IFBench** | tool-call, medpsy | EvalScope / lm-eval | No |
| **GSM8K** | tool-call, one-bit | EvalScope / lm-eval | No |
| **GPQA-Diamond** | tool-call, one-bit | EvalScope / lm-eval `gpqa_diamond_zeroshot` | No |
| **MATH-500** | tool-call, one-bit | EvalScope `math_500` / lm-eval `minerva_math500` | No |
| **MMLU-Pro** | tool-call, medpsy | EvalScope (full) / OpenCompass (health only) | No — and different subsets |
| **MMLU** | one-bit, medpsy | lm-eval (full) / OpenCompass (6 medical subjects) | No — and different subsets |
| **τ-bench** | tool-call, one-bit | EvalScope + `tau2` / custom sbatch | No |
| **BFCL** | tool-call, medpsy | EvalScope / **same, via bridge** | **Yes — already solved** |

Two details worth pulling out.

**BFCL is the model to copy.** Medpsy does not reimplement it — they call the tool-call repo's own runner through a bridge script. One benchmark, one implementation, two teams. That is the target state for every row above, and it already works in practice.

**The IFEval collision is the awkward one.** Two of the three teams use lm-eval; we standardised on EvalScope. So the majority harness is not the one we built. The plan anticipated exactly this and its answer is good: Milestone 3 adds an lm-eval adapter specifically because "it lets us settle the 'two IFEvals' question with real data rather than opinion." **Run the same checkpoint through both, compare, then decide.** Do not settle it by argument.

### How to choose, with least disruption

Four criteria, in order:

1. **Who owns the benchmark's meaning?** If a team's purpose is that benchmark family, they choose. Tool-call owns BFCL, ACEBench and τ; medpsy owns the medical suites. Uncontroversial and settles most rows.
2. **Which harness produced the numbers currently being published?** Switching invalidates history, so the incumbent wins ties.
3. **Which one more teams already use for that benchmark?** Breaks the remaining ties.
4. **Measure before deciding** where two harnesses genuinely disagree — the IFEval case.

**The real cost is re-baselining, and it should be counted openly.** Whoever switches has to re-run their baselines before their history is trustworthy. That means the migration wants a transition period: keep running the non-canonical version, store it, and mark it non-publishable so it never reaches the leaderboard while the comparison is being done. We already have the mechanism for that — a standard with no label produces runs that are not standard runs.

> **Tool team — build now.** Nothing changes. On every collision above, the tool team is either the owner or the incumbent, so the canonical choice lands on EvalScope. Get the collisions written down before another team's number appears next to ours.
>
> **Other teams — don't block.** Two teams would have to move eventually — the low-bit team for GSM8K, GPQA and MATH-500, and medpsy for IFEval and IFBench. Neither should move until we have the comparison data, and the lm-eval adapter is what produces it. Note the low-bit team's MMLU is the *full* benchmark while medpsy's is six medical subjects: that is not a collision at all once `subsets` is a real field, it is two honest standards over one dataset, and it is a good argument for making `subsets` part of a standard's identity.

---

## 9. Where the datasets live, and what they weigh

### How it works today

Datasets are **baked into the harness image at build time.** Two build steps do it: `bake_nltk.py` fetches the NLTK corpora IFEval's checkers need lazily, and `prefetch_dataset.py` loads `opencompass/ifeval` *through the exact code path a real run takes*, so the run-time cache check hits and the container never touches the network. Decision D3 puts it plainly: **the image tag is the dataset pin.**

That is a genuinely nice design for what it covers. A container with no network egress can never discover a missing corpus or a stalled download mid-run.

### What it weighs — measured, not estimated

I measured the caches that are readable on this machine.

| What | Size | Notes |
|---|---|---|
| `LMUData` — VLMEvalKit's converted datasets | **232 GB** | the vision board's working set |
| `…/huggingface/datasets` — same team's raw downloads | **244 GB** | likely overlaps LMUData in content, not in bytes |
| Same team's full HF cache including model weights | **716 GB** | for scale: weights dwarf data |

The vision datasets alone, by size:

| Dataset | Size |
|---|---|
| `MMIU_raw` | 47 GB |
| `WildDoc.tsv` | 17 GB |
| `MMRB_raw` | 12 GB |
| `RefCOCO.tsv` | 4.0 GB |
| `MMRB.tsv` | 2.2 GB |
| `_ST-VQA_full_26k.tsv` | 1.9 GB |
| `MME-RealWorld-Lite.tsv` | 1.9 GB |
| `OCRBench_v2.tsv` | 1.4 GB |
| `TextVQA_VAL.tsv` | 1.2 GB |
| `VLM2Bench` / `POPE` / `MUIRBench_SHUF` | ~1.1 GB each |

Those twelve are about 91 GB of the 232 GB — the rest is a long tail of smaller sets.

**Text is a rounding error by comparison.** I did not find a shared text-dataset cache to measure, but the scale is not in doubt from the contents: IFEval is 541 prompts, GSM8K about 8,500, MMLU-Pro 12,000 multiple-choice questions. These are megabytes each. All the text benchmarks across the three text teams should land in the low single-digit gigabytes, with LiveCodeBench the one likely outlier because it ships executable test cases. **I am estimating that figure rather than reporting it** — it is worth measuring before anyone sizes a disk on it.

### So how much disk?

- **Text-only service (tool team, medpsy, low-bit): tens of GB.** Comfortable on any machine.
- **Add vision: ~500 GB of datasets**, and that is today's board, before video. The Video-MME configs exist in the VLMEvalKit fork and are not in the default board suite; if they are ever switched on, this becomes terabytes.
- **Models are the bigger line item.** Judge models alone — Qwen3.6-27B, Qwen3.5-27B, CompassJudger-2-32B, gpt-oss-120b — run to several hundred GB before a single checkpoint under test is staged.

A sensible starting size for a dataset volume is **1 TB**, but the honest framing is that the number is set entirely by whether vision is in scope, and that model storage should be budgeted separately and larger.

### Does baking scale?

For small text datasets, beautifully. It breaks in three places.

**Size.** You cannot bake 47 GB of MMIU into a container image, let alone 232 GB. There is a ceiling and vision is far past it.

**Rebuild cost.** Every new benchmark means a new image build. `framework_image` is per-standard so multiple images are supported by design, but the count grows and each is a build to maintain.

**It is a workaround for a missing revision.** This is the important one. D3 chose image-as-pin *because* ModelScope exposes no revision for IFEval — the YAML says so directly, and `dataset_revision: null` is the honest record of that. Where a real revision does exist, which is most Hugging Face datasets, pinning `dataset_revision` and mounting a shared read-only cache is strictly better: smaller images, faster builds, and the pin is explicit instead of implied by a tag.

**Recommendation: hybrid, chosen by the same rule.** Bake datasets that are small *and* have no pinnable revision — that is IFEval today and probably a handful of others. For everything else, pin the revision in the standard and mount a shared read-only dataset volume. Keep the no-network-at-run-time property either way; a mounted volume preserves it just as well as a baked layer.

> **Tool team — build now.** Nothing forces a change yet. Every Group A and B dataset is small enough to bake. But the LiveCodeBench and multi_if entries are the first that will not be comfortable, so the volume decision should be made before, not during, that work.
>
> **Other teams — don't block.** Two things make the shared volume mandatory rather than optional. Vision is one, on size alone. The other is that **medpsy has datasets that are not on any hub** — MEDEC and MedSafetyBench are read from a local `COMPASS_DATA_CACHE` path. Those cannot be baked from a public source at all, so a mounted volume is the only mechanism that serves them. Medpsy also needs cached scoring *models* (BERTScore, BLEURT) for MEDEC's text-similarity metrics, which is a third category — not a dataset, not a checkpoint under test, but something the harness needs on disk.

---

## 10. The standards to add

The tool-call team runs **20 benchmarks**. Their `core` suite — what they say a model should be measured on before anyone looks at it — is ten: `bfcl_v3`, `acebench`, `tau2_retail`, `tau2_telecom`, `tau3_banking`, `mmlu_pro`, `gpqa_diamond`, `ifeval`, `ifbench`, `multi_if`. We have one of those ten.

The single most useful fact: **their stack runs on EvalScope, same as ours.** We are not porting across harnesses, we are copying settings between two EvalScope configs.

### Group A — free, nothing new needed

**IFBench** — AllenAI's harder instruction-following set. Same four metrics as IFEval, same rule-based checkers, same batch size. In the tool-call config it has no row at all, because everything about it matches the defaults.

**GSM8K** — grade-school math, 4-shot chain-of-thought, answer pulled from a `\boxed{}` wrapper. Already benchmark two in Milestone 2, already flagged there as needing a decision on the 4-shot-versus-convention question.

Under today's schema that is four files. **Under the Section 5 split it is two** — a small but real demonstration of the point.

> One caveat: GSM8K needs a real answer-extraction step, where IFEval's `extraction.method` is `none`. The field is deliberately shapeless, but GSM8K is the first standard to put anything in it — check the key names against a real run rather than guessing.

### Group B — cheap, one small unblock each

**GPQA-Diamond** — 198 hard science multiple-choice questions, 0-shot with chain-of-thought, choices shuffled. Small enough that the interval is wide, which is why the plan wants it in wave 2: it forces the repeats-and-variance policy.

**MMLU-Pro** — 12,000 ten-choice questions, 5-shot from validation. Biggest generation volume on the list. Blocked on the hardcoded batch size and the fixed 12-hour job limit.

**AIME25** — 30 competition problems. Unreadable without `repeats`. Needs an 81,920-token budget and a 7,200-second timeout.

**MATH-500** — same shape, 500 problems, same budget and timeout. Same change as AIME25 or the unblocking work happens twice.

### Group C — real work, highest value

**BFCL v3** — the tool-calling benchmark. Seventeen subsets covering simple calls, parallel calls, multi-turn and irrelevance. Rolls up to `overall_acc` plus three group scores. Three obstacles, all handled in Section 12.

### Group D — needs a second model

**ACEBench**, the **τ³ family**, and **ToolSandbox**. All blocked on Section 6. **ToolSandbox reports `similarity`, not accuracy** — the 0..1 storage constraint holds, but the leaderboard must not put it in the same visual column as an accuracy without a label.

### Group E — genuinely hard

**multi_if** — 4,501 samples × 3 turns × 11 languages. Nothing conceptually hard, just the largest workload in the suite.

**LiveCodeBench** — executes generated code. The tool-call repo runs it with the sandbox off because their nodes have no Docker; we run the harness in a container on the control plane, a different security posture needing its own think.

### Not recommended

**CEval** — in no suite, no stated need. **`acebench_fc` / `acebench_prompt` / `tau3`** — diagnostic variants for comparing scoring channels; if added, mark them non-publishable.

> **Tool team — build now.** Groups A and B, then C.
>
> **Other teams — don't block.** The overlaps are in Section 8. The one that shapes this section is MMLU-Pro: we would take the full benchmark, medpsy takes the health category only. That is two standards over one dataset, which works cleanly once `subsets` is real.

---

## 11. The serving profiles to add

### Import the families, but name them by what they do

Importing the tool-call `families.yaml` entries as profiles is right — five tested, working configurations. Two adjustments.

**Name by capability, not by owner.** `qwen3-tools` rather than `tool-qwen3`. The reason is mechanical: profiles are content-addressed, so two teams needing the same flags get the same row automatically. A team prefix fights that — medpsy needing an identical config would either reuse a row labelled for another team or create a duplicate. Naming by what the profile *does* keeps the dedupe working and still makes the tool flags obvious.

**Copy the flags, not the sampling.** A `families.yaml` entry mixes engine flags with things that are not engine flags. `reasoning_history` — whether a previous turn's thinking is replayed — is a scoring protocol choice that happens to be implemented by the family, and under Section 5 it belongs with the standard.

### The problem this fixes

Our one profile cannot serve a tool-calling model. The tool-call `qwen3` family sends `--enable-auto-tool-choice --tool-call-parser hermes --reasoning-parser qwen3`; ours renders no tool flags at all. Without them vLLM returns the function call as ordinary text and BFCL scores zero. Nothing is broken today because IFEval uses no tools — it breaks the moment we add anything from Group C or D.

Ours is also called `qwen3`, the same name as their family, and **they are not the same thing.** Rename ours or make it match. Matching is better: a profile that can serve tools is strictly more useful, and IFEval does not care.

### The `as_is` hole

The `as_is_needs_no_reasoning_parser` rule blocks `think_handling: as_is` against any profile carrying a reasoning parser — correctly, because with the parser on the think block never reaches the graded text. We have one profile and it has a parser, so **`as_is` is a setting the schema accepts and the system can never satisfy.** No standard uses it yet; the first person to write one gets a submit-time error with no obvious fix. One no-parser profile closes it.

### The list

| # | Label | What changes vs `qwen3` | Why |
|---|---|---|---|
| 1 | **`qwen3-tools`** | `enable-auto-tool-choice`, `tool-call-parser: hermes` | BFCL, ACEBench, τ³, ToolSandbox |
| 2 | **`qwen3-plain`** | `reasoning_parser: null` | Unblocks `as_is`. One row, closes a hole |
| 3 | **`qwen3-longctx`** | context raised for an 81,920-token budget | AIME25, MATH-500. See warning |
| 4 | **`qwen3_5-tools`** | `tool-call-parser: qwen3_xml`, `language-model-only`, `gdn-prefill-backend: triton` | The Qwen3.5 catalog is served this way |
| 5 | **`qwen3-tp2`** | `gpus: 2`, `tensor_parallel_size: 2` | Anything above ~8B, and the 27B simulator two teams now run |
| 6–8 | **`lfm2` / `minicpm5` / `functiongemma`** | tool parser plugins | Only if we evaluate those models. Blocked below |

Profiles 6 to 8 need `--tool-parser-plugin <path>`. JSON holds the path, but **the file must exist on the compute node.** The tool-call repo expands an `${EVAL_HOME}` variable pointing at their checkout; we have no equivalent and no story for shipping a plugin file to the cluster. Design work, not config.

### Warning on the long-context profile

The `profile_exceeds_model_context` rule refuses to start when context exceeds the checkpoint's trained length, and the reference checkpoint's vLLM log shows `max_seq_len: 40960`. An 81,920-token budget plus the 2,048-token prompt allowance needs about 84k — roughly double what the model was trained for. Getting there means RoPE scaling, a quality trade-off rather than a bigger number. **I am not confident enough to recommend a configuration**; measure it against a known AIME score first.

### What not to do

Do not create a profile per benchmark. One served model answering many tests is where the 350-seconds-per-cold-start saving comes from. The test for a new profile: **does vLLM have to restart to change it?** Tool parser, context length, GPU count — yes. Temperature, max tokens, few-shot — no.

> **Tool team — build now.** Profiles 1 to 3, then 4 and 5 when the models arrive.
>
> **Other teams — don't block.** Medpsy needs `chat_template` and a `base`-vs-`chat` distinction, both JSON. Their judges need profiles of their own, which under Section 6 are ordinary serving profiles pointed at by an auxiliary role. VLMEvalKit needs vision preprocessing and `kv_cache_dtype: fp8`, all JSON — plus **a pool of endpoints rather than one**, which the low-bit team's eight-replica judge fleet now also needs. That is Section 14.2, and it went from one team to two while this document was being written.

---

## 12. Fitting Groups C, D and E into the new shape

The useful test of a schema proposal is whether the hard cases fit.

### Group C — BFCL v3

| What it needs | Where it goes |
|---|---|
| 17 subsets | **`subsets` column**, hashed |
| `temperature: 0.001` | standard's mandated sampling overrides |
| tool-call parser | serving JSON, agreed key, validated |
| `keeps_reasoning_history: true` | hashed standard JSON — changes the score |
| `is_fc_model`, `underscore_to_dot` | hashed standard JSON |
| batch size 64 | operational column, not hashed |

One new column. Everything else is JSON or already exists.

### Group D — ACEBench, τ³, ToolSandbox

| What it needs | Where it goes |
|---|---|
| user simulator | **auxiliary model table** (Section 6), hashed by content |
| ACEBench `family_modes` | hashed standard JSON — changes what the number means |
| `max_dialog_turns: 40` | hashed standard JSON |
| τ³ domain (retail / telecom / banking) | **`subsets`** — the only thing distinguishing those four standards |
| τ³ `retrieval_config: golden_retrieval` | hashed standard JSON |
| ToolSandbox `similarity` | already fine; needs a leaderboard label |
| pass^k | `repeats` already exists |

No new columns beyond `subsets`. The auxiliary table is the whole cost.

### Group E — multi_if, LiveCodeBench

| What it needs | Where it goes |
|---|---|
| `keeps_reasoning_history: false` | same hashed JSON as BFCL — and two benchmarks setting it opposite ways is what proves it is a protocol setting, not an engine detail |
| 11 languages, 3 turns | subgroups; the metrics list already handles multiple cuts |
| LiveCodeBench `release_v6` | **`subsets`** again |
| code execution sandbox | a runner and security question, not a schema one |

### What this adds up to

Across all three groups: **one new hashed column (`subsets`), three unhashed operational columns, one hashed JSON field, and the auxiliary model table.** Everything else fits what exists — which suggests the JSON-first rule is doing real work rather than deferring the problem.

> **Tool team — build now.** `subsets`, the operational columns, the hashed JSON. Covers Group C completely.
>
> **Other teams — don't block.** The same hashed JSON absorbs medpsy's per-suite settings and VLMEvalKit's per-benchmark judge choice. The exception is medpsy's cascade evaluator, which uses a judge to *extract* an answer before rule-scoring it — a second auxiliary role in the same run, which is why Section 6 recommends a role column rather than a single judge slot.

---

## 13. The four hardcoded values

Small, concrete, quietly blocking about eight of the standards above. `backend/app/services/harness/task_config.py` builds the EvalScope job and four of its values are constants that should be fields:

```73:77:/home/naresh/TeamRepos/evaluation-service/backend/app/services/harness/task_config.py
        "repeats": recipe.repeats,
        "seed": 42,  # hardcoded, and inert while v1 runs greedy (temperature 0)
        "limit": recipe.sample_limit,
        "eval_batch_size": 32,
        "work_dir": container_work_dir,
```

**`subset_list: ["default"]`** (line 50) — the worst. Every benchmark gets one subset, always named `default`. Correct for IFEval, wrong for BFCL, τ³, MMLU-Pro and LiveCodeBench. **You cannot express `tau2_retail` at all**, because the only thing distinguishing it from `tau2_telecom` is the subset. Section 12 makes it a hashed column.

**`eval_batch_size: 32`** (line 76) — requests in flight. The tool-call team measured this: MMLU-Pro went 2,179 tokens/sec at batch 32 to 3,950 at 128, and at 32 the client sets the pace while the GPU idles. Meanwhile ACEBench and BFCL's multi-turn subsets want *16*, because there the bottleneck is Python in the worker. So 32 is wrong in both directions. Does not change what is measured, so it stays out of the hash.

**`timeout: 1800`** (line 71) — half an hour per request, where AIME25 and MATH-500 need two hours. One generation outliving the client fails the whole task.

**`seed: 42`** (line 74) — "inert while v1 runs greedy" stops being true the moment a thinking standard samples at 0.6, and `ifeval/v1-think` already does.

There is also **no per-benchmark job time limit.** Cluster settings live in environment variables by decision D9 — fine for one global default, not fine for MMLU-Pro's 24 hours. The tool-call note is a real scar: they raised it "rather than tuned down, because the alternative is dying at 49% with nothing to show, which is how the old stack lost job 165026."

| Value | Line | In the hash? | Blocks |
|---|---|---|---|
| `subset_list` | 50 | **Yes** | BFCL, all τ³, MMLU-Pro, LiveCodeBench |
| `eval_batch_size` | 76 | No | MMLU-Pro, ACEBench, BFCL |
| `timeout` | 71 | No | AIME25, MATH-500 |
| `seed` | 74 | Probably yes | Any non-greedy run's reproducibility |

> **Tool team — build now.** All four. Highest ratio of unblocked work to effort in the document.
>
> **Other teams — don't block.** All four are universal. The low-bit team pins `seed=0` in their model arguments and medpsy runs closed-ended benchmarks three times by default, so both are settings other teams already treat as real.

---

## 14. What still breaks

Everything above is a schema change. These are not.

### 14.1 One runtime has no HTTP at all

Section 4 largely resolved the low-bit concern — they serve over HTTP on their current work, and lm-eval supports OpenAI-compatible endpoints natively. What remains is **VisionPsy's llama.cpp path**, which builds only `llama-mtmd-cli` and never `llama-server`. No endpoint, no URL. The model is two GGUF files at different quantizations — a Q4_0 language model plus a Q8 vision projector — with GPU use controlled by offloaded-layer count rather than a memory fraction.

This is a deliberate scope decision, not a schema gap: either the service supports a non-HTTP execution mode for edge runtimes, or it explicitly does not and that team's on-device numbers live elsewhere.

### 14.2 Two teams need endpoint pools, not endpoints

VLMEvalKit starts one vLLM per GPU and load-balances, then reuses freed GPUs for judge replicas. The low-bit team's judge fleet starts eight replicas and writes their URLs to a file for downstream jobs to read. Our `endpoint` table holds a single URL per row. A pool is not a bigger endpoint — it has its own health, its own concurrency, and a two-phase lifecycle.

### 14.3 Quantization is sometimes a property of the weights

For the low-bit team, ternary quantization is baked into the checkpoint by a materialization step *before* evaluation, and vLLM then loads it as ordinary bfloat16 with `quantization=None`. A serving profile saying `quantization: null` is simultaneously accurate and completely misleading about what is being measured.

We have `quantization` on both the checkpoint and the profile plus a rule warning when they disagree, which is the right instinct. But for a team whose purpose is comparing quantized models against full-precision baselines, "which quantization" and "compared to which baseline" are the primary axis of the leaderboard, not a footnote — their manifests carry `tier` and `group` fields for exactly this.

### 14.4 Not every score is 0..1, or higher-is-better

`metric.value` is constrained to 0..1. Counterexamples: VLMEvalKit's **OmniDocBench reports edit distance, where lower is better**, MME reports a summed score that is not a fraction, and medpsy's MedSafety reports mean harmfulness, also lower-is-better. We do have `higher_is_better` per metric — the important half — but the storage constraint needs revisiting before a vision or safety suite lands.

> **Tool team — build now.** Nothing. None of these four affect any tool-call benchmark.
>
> **Other teams — don't block.** These are the four to raise before promising anything. 14.1 is a scope decision worth making deliberately rather than drifting into; 14.2 is now two teams and rising, so it is the one most likely to become urgent.

---

## 15. Suggested order of work

**Step 1 — Unblock the harness builder.** Turn `subset_list`, `eval_batch_size` and `timeout` into fields; decide `seed`. Small, self-contained, prerequisite for most of what follows.

**Step 2 — IFBench and GSM8K.** No new infrastructure. Proves the registry is not hardcoded around IFEval.

**Step 3 — Fix the serving profile inventory.** Tool flags on `qwen3` (or rename and add `qwen3-tools`), plus the no-parser profile. Two rows; closes the `as_is` hole and unblocks every tool-use benchmark.

**Step 4 — Decide the recipe split.** Section 5. Before there are twenty standards to migrate, not after — the migration is mechanical now and gets worse with every standard added.

**Step 5 — GPQA-Diamond and MMLU-Pro.** Needs step 1, a per-benchmark job time limit, and the repeats-and-variance policy GPQA forces.

**Step 6 — BFCL v3.** Agree the `engine_options` key names and write the validation rule *first*, so it exists before the first silently-zero run.

**Step 7 — Design the auxiliary model table.** Section 6. Before any ACEBench or τ³ YAML. This also unblocks medpsy, so build it properly rather than tool-team-shaped.

**Step 8 — Everything else**, roughly in the plan's wave order.

Three items sit outside the sequence:

- **AIME25 and MATH-500** are cheap once the timeout is a field, but need the long-context profile, which needs the RoPE question answered by measurement.
- **The dataset volume decision** (Section 9) should be made before LiveCodeBench or any medpsy work, not during.
- **The lm-eval adapter** is what settles the IFEval harness collision with data instead of opinion. It is already Milestone 3 in the plan; Section 8 is the argument for not deciding the collision before it exists.

---

## 16. Appendix — reference tables

### 16.1 All 20 tool-call benchmarks

| Benchmark | Group | Primary metric | What blocks it today |
|---|---|---|---|
| `ifeval` | — | `prompt_level_strict` | **Already done** |
| `ifbench` | A | `prompt_level_strict` | Nothing |
| `gsm8k` | A | `accuracy` | Nothing (first real extraction step) |
| `gpqa_diamond` | B | `accuracy` | Repeats/variance policy |
| `mmlu_pro` | B | `accuracy` | Batch size; 24h job limit |
| `aime25` | B | `accuracy` | Timeout; long-context profile |
| `math_500` | B | `accuracy` | Timeout; long-context profile |
| `bfcl_v3` | C | `overall_acc` | Subsets; tool parser; reasoning history |
| `acebench` | D | `overall_acc` | Auxiliary model; per-family modes |
| `acebench_fc` / `acebench_prompt` | not rec. | `overall_acc` | Diagnostic variants |
| `tau2_retail` / `tau2_telecom` / `tau3_banking` / `tau2_airline` | D | `accuracy` | Auxiliary model; **subsets** |
| `tau3` | not rec. | `accuracy` | Three domains as one job |
| `tool_sandbox` | D | `similarity` | Auxiliary model; non-accuracy metric |
| `multi_if` | E | `overall_avg` | Size; reasoning history |
| `live_code_bench` | E | `accuracy` (pass@1) | Code execution; subsets |
| `ceval` | skip | `accuracy` | No stated need |

### 16.2 Serving flags across teams

| Flag | Who uses it | Home under Section 7 |
|---|---|---|
| `--reasoning-parser` | all four eval teams | column ✅ |
| `--tensor-parallel-size` | all | column ✅ |
| `--max-model-len` | all | column ✅ |
| `--dtype` | all | column ✅ |
| `--gpu-memory-utilization` | vLLM teams | column today; no llama.cpp equivalent |
| `--enable-auto-tool-choice` | tool-call, one-bit | JSON |
| `--tool-call-parser` | tool-call, one-bit | JSON, agreed key, validated |
| `--tool-parser-plugin` | tool-call (3 families) | JSON — but **nothing ships the file** |
| `--trust-remote-code` | tool-call, medpsy, one-bit | JSON |
| `--language-model-only` | tool-call, medpsy, one-bit | JSON |
| `--chat-template` | medpsy, VLMEvalKit | JSON |
| `--mm-processor-kwargs` | VLMEvalKit | JSON |
| `--kv-cache-dtype fp8` | VLMEvalKit | JSON |
| `--default-chat-template-kwargs` (thinking) | tool-call, one-bit | we set this per request instead |
| `--max-num-seqs` | tool-call, one-bit, VLMEvalKit | **no home today** |
| `-ngl`, `--mmproj`, `MTMD_NO_UPSCALE` | visionpsy llama.cpp | JSON — but see 14.1 |

### 16.3 Sampling profiles to import

Directly usable as the first `sampling_profile` rows. Our two IFEval standards already match `greedy` and `qwen3_think` exactly, which suggests we copied the right thing first time.

| Profile | temp | top_p | top_k | other | max_tokens |
|---|---|---|---|---|---|
| `greedy` | 0.0 | — | — | — | 8192 |
| `qwen3_think` | 0.6 | 0.95 | 20 | — | 16384 |
| `qwen3_5_think` | 1.0 | 0.95 | 20 | presence_penalty 1.5 | 32768 |
| `lfm2_5_think` | 0.6 | 0.95 | 20 | — | 16384 |
| `lfm2_5_2_6b` | 0.1 | — | 50 | repetition_penalty 1.1 | 16384 |
| `minicpm5_instruct` | 0.7 | 0.95 | — | — | 8192 |
| `minicpm5_think` | 0.9 | 0.95 | — | — | 16384 |

On `presence_penalty: 1.5` in `qwen3_5_think`: their comment says it curbs a repetition loop the small models fall into and is "what makes generation terminate at all" — a real constraint. Our builder does forward `presence_penalty`, so it works as intended.

The related confusion is worth clearing up because it is easy to read the wrong way. The comment column in our IFEval YAML wraps across lines and looks as though decision D4 forces `presence_penalty` to `0.0`. It does not. **D4 is about `min_p` and only `min_p`** — the sole entry in `FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS`, because EvalScope's `openai_api` path drops it silently. The neighbouring `presence_penalty: 0.0` is just our own neutral default. None of the seven profiles above sets a non-zero `min_p`, so importing all of them would not trip the D4 warning once.

### 16.4 Auxiliary models across teams

| Team | Role | Model | Sampling | Serving |
|---|---|---|---|---|
| tool-call | user simulator | GLM-5.2 (remote) | max_tokens 1000, thinking off | remote API, key from env |
| tool-call | user simulator | Qwen3.8-27B | max_tokens 1000, thinking off | TP=2, +2 GPUs on the job |
| medpsy | judge (generic) | CompassJudger-2-32B | temperature 0.01 | second vLLM, eval phase only |
| medpsy | judge (HealthBench) | per suite | temperature 0.5 | as above |
| medpsy | judge (arena) | gpt-oss-20b | temperature 0 | as above |
| medpsy | **extractor** | per suite | as judge | cascade: judge extracts, rules score |
| one-bit | judge | Qwen3.5-27B | — | **8 replicas, TP=1, ports 8900+** |
| one-bit | judge (MT-Bench) | gpt-oss-120b | per-category temps | remote hosted API |
| one-bit | user simulator | Qwen3.6-27B | thinking off | TP=2, tool parser `qwen3_coder` |
| VLMEvalKit | judge | Qwen3.6-27B-FP8 as `gpt-4o-mini` | temperature 0, thinking off | one replica per freed GPU, kv-cache fp8 |

Four teams, three role names, one shape: a checkpoint, a sampling profile, a serving profile, and a role. That is the argument of Section 6 in one table — and the reason it should be a table in the database too.

### 16.5 Measured dataset storage

| What | Size | Source |
|---|---|---|
| `LMUData` (VLMEvalKit converted datasets) | **232 GB** | measured |
| `…/huggingface/datasets` (same team) | **244 GB** | measured |
| Same team's full HF cache incl. weights | **716 GB** | measured |
| Largest single dataset (`MMIU_raw`) | **47 GB** | measured |
| All text benchmarks, all text teams | low single-digit GB | **estimated, not measured** |
