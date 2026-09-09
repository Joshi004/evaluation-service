# Standards, Sampling Profiles and Serving Profiles — What to Add and How to Shape It

**Date:** Sep 2026
z**Scope:** `evaluation-service` compared against all five team repos — `qvac-research-tool-call`, `qvac-research-medpsy`, `qvac-research-one-bit-models`, `tether_VLMEvalKit`, `qvac-visionpsy-nano`
**Status:** Research notes. Nothing here changes code.

This document started as a shopping list of benchmarks to add. Looking at the other four teams turned it into something bigger: a proposal to change the shape of a recipe, and a finding that one concept we thought was tool-team-specific is actually needed by three teams out of four.

**How to read this.** We are building one service for every team, but we start with the tool team. So throughout, each section is split the same way:

> **Tool team — build now.** What we need for the benchmarks we are adding first.
>
> **Other teams — don't block.** What the same section has to leave room for, without building it yet.

If you only care about the next month of work, read the "build now" halves.

---

## Table of contents

1. [Plain-English refresher](#1-plain-english-refresher)
2. [Where we are today](#2-where-we-are-today)
3. [The four other teams in one picture](#3-the-four-other-teams-in-one-picture)
4. [Shape change 1 — split the recipe in two](#4-shape-change-1--split-the-recipe-in-two)
5. [Shape change 2 — the second model is a first-class thing](#5-shape-change-2--the-second-model-is-a-first-class-thing)
6. [Shape change 3 — when to use a column and when to use JSON](#6-shape-change-3--when-to-use-a-column-and-when-to-use-json)
7. [The standards to add](#7-the-standards-to-add)
8. [The serving profiles to add](#8-the-serving-profiles-to-add)
9. [Fitting Groups C, D and E into the new shape](#9-fitting-groups-c-d-and-e-into-the-new-shape)
10. [The four hardcoded values](#10-the-four-hardcoded-values)
11. [What the other teams break that nothing here fixes](#11-what-the-other-teams-break-that-nothing-here-fixes)
12. [Suggested order of work](#12-suggested-order-of-work)
13. [Appendix — reference tables](#13-appendix--reference-tables)

---

## 1. Plain-English refresher

Four words, used precisely throughout.

**A standard** is *what test to run and how to grade it*. Which dataset, how many examples to show first, how to pull the answer out, which numbers to report. It should be identical for every model, because that is what makes two scores comparable.

**A sampling profile** is *how we ask the model to speak*. Temperature, top_p, how many tokens it may generate, whether thinking is switched on. This genuinely depends on the model — Qwen's own guidance says greedy decoding makes their thinking models repeat and degenerate — so it cannot be one global setting.

**A serving profile** is *how we start the model's server*. Engine, GPUs, context window, which parsers are enabled. It says nothing about which test you are running, and that is the point: one running server can answer many tests.

**An auxiliary model** is *a second model that takes part in producing the score*. A judge that grades an answer, or a simulated user that holds up the other end of a conversation. Section 5 is about this, and it is the biggest finding in the document.

One more, because it comes up in Section 11:

**Execution mode** is *how the harness reaches the model*. We assume it always talks HTTP to a running server. Two of the five repos do not — they load the model inside the harness process instead.

---

## 2. Where we are today

| Thing | Count | What it is |
|---|---|---|
| Standards | **2** | `ifeval/v1-instruct`, `ifeval/v1-think` |
| Serving profiles | **1** | `qwen3` |
| Harness frameworks | **1** | EvalScope, image `registry.local/evalscope:2ce95c3` |
| Checkpoints | **1** | `Qwen3-4B-allternary-ep03` |

The two standards are the same benchmark twice — thinking off, thinking on. Layer 1 is byte-identical between them; only sampling and `enable_thinking` differ. So we have **one** benchmark covered, and we have already paid the cost of duplicating a whole file to change three numbers. That is a small preview of Section 4.

The single serving profile:

| Field | Value |
|---|---|
| `engine` / `engine_version` | `vllm` / `0.19.0` |
| `gpus` / `tensor_parallel_size` / `pipeline_parallel_size` | `1` / `1` / `1` |
| `max_model_len` | `32768` |
| `reasoning_parser` | `qwen3` |
| `dtype` / `quantization` | `auto` / `null` |
| `gpu_memory_utilization` | `0.85` |
| `engine_options` | `{}` |

---

## 3. The four other teams in one picture

Short version: **everyone separates sampling from the benchmark, three of four need a second model, and two of five never start a server at all.**

| | tool-call | medpsy | one-bit-models | VLMEvalKit | visionpsy-nano |
|---|---|---|---|---|---|
| **Harness** | EvalScope | OpenCompass fork | lm-eval 0.4.12 | VLMEvalKit fork | none (model repo) |
| **How the model is reached** | vLLM over HTTP | vLLM over HTTP | **in-process** | vLLM HTTP **pool** | vLLM HTTP, or **llama.cpp CLI** |
| **Needs a second model?** | **Yes** — user simulator | **Yes** — judge | No | **Yes** — judge | n/a |
| **Sampling lives where?** | model catalog | model profile | manifest `gen_kwargs` | model registration | script defaults |
| **Sampling inside the benchmark?** | only where mandated | no | no | no | n/a |
| **Benchmarks** | 20 | 18 | 18 | 61 units | none |

Three things follow from that table, and they are Sections 4, 5 and 11.

**Nobody puts temperature inside a benchmark definition.** All four harnesses keep sampling in a model-shaped place and let a benchmark override individual keys only where its published definition demands it. We are the only one that bakes the whole sampling block into the benchmark recipe. That is Section 4.

**Three of four need a second model, and they need it for the same reason.** That is Section 5.

**Two of five never speak HTTP.** That is Section 11, and it is the one problem this document does not solve.

---

## 4. Shape change 1 — split the recipe in two

### The proposal

Today one `recipe` row holds both the protocol and the sampling, and one hash covers both. The proposal is to split it:

| New thing | Holds | Changes when |
|---|---|---|
| **`standard`** | benchmark, framework, dataset, split, subsets, few-shot, prompt, extraction, metrics, repeats — plus the sampling the benchmark's own definition *mandates* | we change what the test is |
| **`sampling_profile`** | temperature, top_p, top_k, min_p, penalties, max_tokens, enable_thinking | we change how we ask the model to speak |
| **`serving_profile`** | engine and its flags | we change how the server is started |

### This is not a new idea — it is the original plan

Worth saying up front, because it makes the change much easier to justify. `EVAL_SERVICE_PLAN.md` Section 5 already specifies exactly this, in detail: Layer 1 is the protocol, Layer 2 is "the run profile," and the data model at line 509 has a `model_profile` table sitting next to `recipe`. V1 deliberately folded Layer 2 into the recipe hash as a simplification, and `DATA_MODEL_V1.md` Section 8 records that as a known simplification rather than a decision that Layer 2 does not exist.

So this is **un-simplifying something we simplified on purpose**, now that we know more. That is a normal thing to do and a much smaller argument than proposing a new architecture.

### Why it is worth doing

**Every other team already works this way.** Four out of four. That is the strongest evidence available, and it is not a coincidence — it is because sampling is a property of the checkpoint, not of the test.

**The duplication is already visible at two standards.** Our two IFEval files are identical except for `enable_thinking` and six sampling numbers. Multiply by the twenty benchmarks in Section 7 and we are maintaining forty files that restate the same handful of sampling blocks. Change our greedy policy and we edit twenty of them, and any one we miss is a silently wrong number.

**It makes the auxiliary model expressible.** This is the argument I did not expect, and it is the best one. A judge or a user simulator is described by exactly three things: which model, how it samples, how it is served. If sampling has no independent existence, there is nowhere to put "the judge runs at temperature 0.01" except inside the benchmark recipe, glued to a name. With the split, the second model reuses the same three concepts as the first. Section 5 depends on this.

### The part that must not get lost

The whole pitch of this service is "numbers on the leaderboard are comparable." One hash covering everything is what guarantees that today. Split it into three and you can accidentally put two IFEval scores side by side that were taken at different temperatures.

The plan already solved this and the solution has to come back with the split: **every run stores a resolved composite hash**, computed from the values that were actually used, not the ones that were requested. The leaderboard groups by it. Two rows may only share a ranking if they share it.

The plan calls this `profile_hash` and pairs it with `resolved_profile`, the concrete values that reached the model. Both matter: the resolved values are what you hash, and the recorded choice is what you show the user. A bug in resolution then shows up as a hash mismatch instead of a wrong number wearing the right label.

**Open question worth deciding explicitly:** does the *serving* profile go into that comparison hash, or only the standard and the sampling? The plan says only the standard and sampling. But serving choices can move a score — a different KV-cache precision, a different quantization — and the whole point of the one-bit-models team is that quantization changes numbers. For them the quantization is baked into the checkpoint, so checkpoint identity covers it; for a profile that quantizes at serve time it would not. I do not think this should be settled in a research document, but it should be settled before the split ships.

### The three-layer resolution order

Splitting sampling out does not mean the standard has no say. Some sampling is mandated by the benchmark: BFCL specifies near-greedy `temperature: 0.001`, AIME25 needs an 81,920-token budget or the problems do not fit. Those are not free choices, they are part of the protocol.

The tool-call repo already has the right precedence and even the right warning in its comments — its `sampling_overrides` key is documented as "for what the benchmark's definition requires, not for what is fast." Copy that:

```
sampling profile (from the checkpoint)
  ← overridden by → standard's mandated overrides (from the benchmark)
    ← overridden by → what the user typed at submit time
```

Resolve those three, store the result, hash the result.

> **Tool team — build now.** Two tables instead of one, three-layer resolution, composite hash on the run. Roughly seven named sampling profiles, which we can lift directly from the tool-call catalog (Appendix 13.3).
>
> **Other teams — don't block.** Medpsy resolves sampling the same way but with one wrinkle: a non-empty `generation_kwargs` block *replaces* the inherited one rather than merging key by key. If we pick merge semantics — and we should, because it is what tool-call does and what the three-layer order above implies — that is a difference to write down, not to discover later. VLMEvalKit's board policy is simpler than anybody's: greedy everywhere, on purpose, so that vision scores are reproducible. That is just one more named profile.

---

## 5. Shape change 2 — the second model is a first-class thing

This is the finding that changed my recommendation from last time.

### Three teams, three names, one concept

| Team | What they call it | Which model | How it is served |
|---|---|---|---|
| tool-call | user simulator | GLM-5.2 (remote API), or self-hosted Qwen3.8-27B | second vLLM launched in the same job, on 2 extra GPUs |
| medpsy | judge | CompassJudger-2-32B, gpt-oss-20b, Gemma4_31B | second vLLM started on the worker for the eval phase |
| VLMEvalKit | judge | Qwen3.6-27B-FP8, aliased as `gpt-4o-mini` | one replica per freed GPU after inference finishes |

I had this filed as "a tool-team problem for ACEBench." It is not. **Three of the four teams that run evaluations need a second model, and they need it for the same structural reason:** the score is not a function of the model's output alone. Something else has to read that output, or talk back to it, and whatever that something else is becomes part of the measurement.

### Does it change the number? Yes, and everybody knows it

This is the user's question — where does it belong — and the evidence answers it clearly.

The tool-call config says one shared simulator instance "keeps the user's behaviour fixed across every model compared against it. That is the whole point — a simulator that drifts makes two models' agent scores incomparable."

VLMEvalKit goes further and makes it a hard failure. Their fork removed upstream's silent fallback to exact-match scoring when the judge is unreachable:

```284:289:/home/naresh/TeamRepos/tether_VLMEvalKit/vlmeval/dataset/image_mcq.py
            if not model.working():
                raise RuntimeError(
                    'Judge endpoint is not working. Refusing to fall back to exact matching '
                    'so every recorded score is judge-backed; re-run when the judge is up.\n'
                    + DEBUG_MESSAGE
                )
```

They would rather lose the run than record a number produced a different way. That is the same instinct as our recipe hash, expressed as an exception.

And the judge's own sampling matters: medpsy runs it at 0.01 for generic grading, 0.5 for HealthBench rubrics, and 0 for arena judging. Three different temperatures for three different grading jobs, all deliberate.

**So the auxiliary model's identity and sampling belong in the standard, and must be in the comparison hash.** Not in the serving profile, not in a free-text note.

### The shape it wants

Here is why Section 4 has to come first. Once sampling is its own thing, the auxiliary model needs no new vocabulary at all:

| | Model under test | Auxiliary model |
|---|---|---|
| which weights | `checkpoint` | `checkpoint` (or a remote endpoint) |
| how it speaks | `sampling_profile` | `sampling_profile` |
| how it is served | `serving_profile` | `serving_profile` |

A run that needs a judge points at two of each. That is it. The only genuinely new fields are the role it plays (`judge` or `user_simulator`) and, for the remote case, a URL and the name of the environment variable holding the key — never the key itself, since these configs are committed.

### The one hard part

It is not the schema, it is the GPUs. A self-hosted auxiliary model needs its own hardware *at the same time* as the model under test, and the three teams solve it three different ways: tool-call adds 2 GPUs to the same job, medpsy starts the judge for the eval phase only, VLMEvalKit waits until inference is done and then uses the freed GPUs for judge replicas. Our endpoint and serve-job machinery assumes one model per job.

> **Tool team — build now.** Nothing. Every benchmark in Groups A, B and C works without a second model. But design the standard schema so the fields have somewhere to go, because the moment we want ACEBench or τ³ we need all of it.
>
> **Other teams — don't block.** Medpsy needs this on day one — most of their suites are judge-scored, and their judge is chosen per suite. VLMEvalKit needs it plus replica counts, because they run one judge per GPU. Both alias the judge to a fixed name (`gpt-4o-mini`) that resolves to a local server, so the judge's *label* and its *actual weights* are separate things and both need recording. If we only record the alias we will publish scores whose grader we cannot identify.

---

## 6. Shape change 3 — when to use a column and when to use JSON

The proposed rule is: **team-specific settings go in a JSON field, universal ones get a real column.** That is a good rule. Here is the sharper version and what it decides.

### The rule, stated precisely

A field earns a column when **both** are true:

1. **More than one team needs it** — otherwise every team's pet flag becomes a migration, and the table grows forever.
2. **The service itself has to read it** to make a decision: validate a combination, recommend a profile, decide two endpoints can be reused.

Everything else goes in JSON.

### We already do this, which makes it easy

The `extraction` field is a shapeless JSON object with `extra="allow"`, and it *is* in the recipe hash. So the pattern of "hashed JSON blob for the parts that vary per benchmark" is already established, tested, and shipping. This is not a new mechanism, it is applying an existing one more widely.

### Applying it — and changing my previous recommendation

Last time I argued the tool-call parser deserved a column. Having looked at the other four teams, **that was wrong and the JSON-first instinct is right.**

The reason it is wrong: only one team needs it. Medpsy touches tool calling only through a thin overlay that borrows the tool-call repo's own harness. The vision teams have no use for it. A column would be one team's flag promoted into everybody's schema, which is exactly what the rule exists to prevent.

My original worry still stands, though — a BFCL run against a profile with no tool parser scores zero and looks like a bad model rather than a broken setup. But that worry is satisfied by something cheaper than a column: **a known key name inside `engine_options`, and a validation rule that reads it.** The validator does not care whether it reads `profile.tool_call_parser` or `profile.engine_options["tool-call-parser"]`. What it needs is an agreed spelling. So: agree the spelling, write the rule, skip the migration.

Worth noticing that the current table already breaks the rule in the other direction. `gpu_memory_utilization` is a NOT NULL column, and llama.cpp has no equivalent concept at all — it controls GPU use by counting offloaded layers (`-ngl`), not by reserving a fraction of memory. So we already have a vLLM-specific setting promoted to a universal column. Not urgent, but it means "our columns are the universal ones" is not true today, and we should stop assuming it.

### Where each disputed field lands

| Field | Column or JSON | Why |
|---|---|---|
| `engine`, `engine_version` | **column** | every team, and reuse depends on it |
| `max_model_len` / context size | **column** | every engine has one, and we validate against it |
| `dtype`, `quantization` | **column** | every team; one-bit-models exists because of it |
| `tensor_parallel_size`, `gpus` | **column** | multi-GPU is universal; we already validate they agree |
| `reasoning_parser` | **column** | three teams use it, and two compatibility rules read it |
| **`tool_call_parser`** | **JSON, with an agreed key** | one team — but validated, see above |
| `subsets` | **column** | every single team subsets something |
| `eval_batch_size`, `timeout`, `seed` | **column, not hashed** | universal and operational |
| `chat_template` | JSON | medpsy and VLMEvalKit; a path, not a decision we validate |
| `downsample_mode`, `max_pixels`, `min_pixels` | JSON | vision only |
| `mmproj` path, `n_gpu_layers`, `mtmd_no_upscale` | JSON | llama.cpp only |
| `kv_cache_dtype` | JSON | one team so far |
| ACEBench `family_modes`, τ³ `retrieval_config`, `max_dialog_turns` | **JSON, hashed** | one benchmark each, but they change the score |

### The distinction that actually decides things

Two JSON fields, not one, because they are hashed differently:

- **Does it change the number when everything is working correctly?** → it belongs to the **standard**, and the JSON blob holding it goes **in the hash**. ACEBench's per-family scoring mode, the judge's identity, τ³'s retrieval setting.
- **Does it decide whether the thing works at all?** → it belongs to **serving**, gets **validated**, and stays out of the comparison hash. The tool-call parser, the vision plugin path, the number of offloaded layers.

That is the clean answer to "where do the tool parser and the user simulator belong." They feel similar — both are fiddly, both are needed for tool benchmarks — but they are opposites under this test. Without a tool parser, BFCL does not produce a wrong number, it produces a broken one. With a different judge, ACEBench produces a perfectly valid number that simply is not comparable to yesterday's.

> **Tool team — build now.** One hashed JSON field on the standard for benchmark-specific protocol settings; keep using `engine_options` for engine flags, with agreed key names for the ones we validate.
>
> **Other teams — don't block.** The same two JSON fields absorb almost everything the other three teams need, which is the main evidence that the rule is right. Vision pixel caps, judge chat templates, GGUF paths, KV-cache precision — all engine-side JSON. Judge identity and rubric version — hashed standard-side JSON. The things that genuinely will not fit are in Section 11, and none of them are fixable with a JSON field.

---

## 7. The standards to add

Grouped by what they cost us, not by how interesting they are.

The tool-call team runs **20 benchmarks**. Their `core` suite — what they say a model should be measured on before anyone looks at it — is ten: `bfcl_v3`, `acebench`, `tau2_retail`, `tau2_telecom`, `tau3_banking`, `mmlu_pro`, `gpqa_diamond`, `ifeval`, `ifbench`, `multi_if`. We have one of those ten.

The single most useful fact: **their whole stack runs on EvalScope, same as ours.** We are not porting across harnesses, we are copying settings between two EvalScope configs. Same datasets, same graders, same metric names underneath.

### Group A — free, nothing new needed

**IFBench** — AllenAI's harder instruction-following set. Same four metrics as IFEval, same rule-based checkers, same batch size. In the tool-call config it does not even have a row, because everything about it matches the defaults.

**GSM8K** — grade-school math, 4-shot chain-of-thought, answer pulled from a `\boxed{}` wrapper. Already named as benchmark two in Milestone 2, already flagged there as needing a decision on the 4-shot-versus-convention question.

Under today's schema that is four files (instruct and think for each). **Under the Section 4 split it is two**, which is a small but real demonstration of the point.

> One caveat on GSM8K: it needs a real answer-extraction step, where IFEval's `extraction.method` is `none`. The field is deliberately shapeless so it can hold whatever EvalScope wants, but GSM8K is the first standard to put anything in it — check the key names against a real run rather than guessing.

### Group B — cheap, one small unblock each

**GPQA-Diamond** — 198 hard science multiple-choice questions, 0-shot with chain-of-thought, choices shuffled. Small enough that the interval is wide, which is why the plan wants it in wave 2: it forces the repeats-and-variance policy.

**MMLU-Pro** — 12,000 ten-choice questions, 5-shot from validation, `ANSWER: [LETTER]` extraction. Biggest generation volume on the list. Blocked on the hardcoded batch size and on the fixed 12-hour job limit.

**AIME25** — 30 competition problems. Thirty. Unreadable without `repeats`. Needs an 81,920-token budget and a 7,200-second timeout.

**MATH-500** — same shape, 500 problems, same budget and timeout. Do it in the same change as AIME25 or the unblocking work happens twice.

### Group C — real work, highest value

**BFCL v3** — the tool-calling benchmark. Seventeen subsets covering simple calls, parallel calls, multi-turn, and irrelevance (does the model correctly decline?). Rolls up to `overall_acc` plus three group scores. Three obstacles, all covered in Section 9.

### Group D — needs a second model

**ACEBench**, the **τ³ family** (`tau2_retail`, `tau2_telecom`, `tau3_banking`, `tau2_airline`), and **ToolSandbox**. All blocked on Section 5. Also worth noting **ToolSandbox reports `similarity`, not accuracy** — the storage constraint of 0..1 is satisfied, but the leaderboard must not put it in the same visual column as an accuracy without saying so.

### Group E — genuinely hard

**multi_if** — 4,501 samples × 3 turns × 11 languages. Nothing conceptually hard, just the largest workload in the suite; do not point it at a new system.

**LiveCodeBench** — executes generated code. The tool-call repo runs it with the sandbox off because their compute nodes have no Docker. We run the harness in a container on the control plane, which is a different security posture and needs its own think.

### Not recommended

**CEval** (Chinese multiple choice) — in no suite, no stated need. **`acebench_fc` / `acebench_prompt` / `tau3`** — diagnostic variants for comparing scoring channels; useful for research, and if added should be marked non-publishable so they never reach the leaderboard.

> **Tool team — build now.** Groups A and B, then C.
>
> **Other teams — don't block.** Two overlaps are already visible and worth planning for rather than colliding with. **MMLU-Pro is run by two teams differently** — we would take the full benchmark, medpsy takes the health category only. That is two standards over one dataset, which the schema handles fine as long as subsets are a real field (Section 9). **IFEval is run by three teams**, and medpsy already routes theirs through the tool-call repo's EvalScope, so precedent for a single canonical owner exists. One-bit-models runs IFEval through lm-eval instead, and reads the metric under a different key (`prompt_level_strict_acc,none` rather than `prompt_level_strict:mean`) — the same benchmark, two harnesses, two spellings. That is the "two IFEvals" question the plan wants to settle with real data.

---

## 8. The serving profiles to add

### Import the families, but name them by what they do

The proposal is to import the tool-call `families.yaml` entries as profiles, prefixed with `tool` to mark them as carrying tool-calling arguments. The instinct is right — those five families are a tested, working set, and the tool-specific flags do need to be visible in the name. Two adjustments.

**Name by capability, not by owner.** `qwen3-tools` rather than `tool-qwen3`. The reason is mechanical: profiles are content-addressed, so two teams that need the same flags get the same row automatically. A team prefix in the label fights that — medpsy needing the identical config would either reuse a row labelled for another team, or create a duplicate. Naming by what the profile *does* keeps the dedupe working and still makes the tool flags obvious.

**Copy the flags, not the sampling.** A `families.yaml` entry mixes engine flags with things that are not engine flags at all. `reasoning_history` — whether a previous turn's thinking is replayed to the model — is a scoring protocol choice that happens to be implemented by the family, and under Section 4 it belongs with the standard. Import the vLLM flags; route the rest to its proper home.

### The problem this fixes

Our one profile cannot serve a tool-calling model. The tool-call `qwen3` family sends `--enable-auto-tool-choice --tool-call-parser hermes --reasoning-parser qwen3`. Ours renders no tool flags at all. Without them vLLM returns the function call as ordinary text and BFCL scores zero. Nothing is broken today because IFEval uses no tools — it breaks the moment we add anything from Group C or D.

Our profile is also called `qwen3`, the same name as their family, and **they are not the same thing.** Either rename ours or make it match. Making it match is better: a profile that can serve tools is strictly more useful, and IFEval does not care.

### The `as_is` hole

The `as_is_needs_no_reasoning_parser` rule blocks any recipe with `think_handling: as_is` from running against a profile carrying a reasoning parser — correctly, because with the parser on, the think block never reaches the text being graded. We have one profile and it has a parser. So `as_is` is a setting the schema accepts and the system can never satisfy. No standard uses it yet; the first person to write one gets a submit-time error with no obvious fix. One no-parser profile closes it.

### The list

| # | Label | What changes vs `qwen3` | Why |
|---|---|---|---|
| 1 | **`qwen3-tools`** | `enable-auto-tool-choice`, `tool-call-parser: hermes` | Required for BFCL, ACEBench, τ³, ToolSandbox |
| 2 | **`qwen3-plain`** | `reasoning_parser: null` | Unblocks `as_is`. One row, closes a whole hole |
| 3 | **`qwen3-longctx`** | context raised for an 81,920-token budget | AIME25, MATH-500. See warning below |
| 4 | **`qwen3_5-tools`** | `tool-call-parser: qwen3_xml`, `language-model-only`, `gdn-prefill-backend: triton` | The whole Qwen3.5 catalog is served this way |
| 5 | **`qwen3-tp2`** | `gpus: 2`, `tensor_parallel_size: 2` | Anything above ~8B, and the self-hosted 27B simulator |
| 6–8 | **`lfm2` / `minicpm5` / `functiongemma`** | tool parser plugins | Only if we evaluate those models. Blocked, see below |

Profiles 6 to 8 all hit the same wall: they need `--tool-parser-plugin <path>`. JSON can hold the path, but **the file has to exist on the compute node**. The tool-call repo expands a `${EVAL_HOME}` variable pointing at their checkout; we have no equivalent and no story for shipping a plugin file to the cluster. That is design work, not config, which is why they are last.

### Warning on the long-context profile

The `profile_exceeds_model_context` rule refuses to start when the context exceeds the checkpoint's trained length, and the reference checkpoint's vLLM log shows `max_seq_len: 40960`. An 81,920-token budget plus the 2,048-token prompt allowance needs about 84k — roughly double what the model was trained for. Getting there means RoPE scaling, which is a quality trade-off and not just a bigger number. **I am not confident enough to recommend a configuration**; it should be measured against a known AIME score first. Flagging it as the open question it is.

### What not to do

Do not create a profile per benchmark. The point of splitting profiles from standards is that one served model answers many tests — that is where the 350-seconds-per-cold-start saving comes from. The test for "is this a new profile" is simple: **does vLLM have to restart to change it?** Tool parser, context length, GPU count — yes. Temperature, max tokens, few-shot — no, that is the sampling profile or the standard.

> **Tool team — build now.** Profiles 1 to 3, then 4 and 5 when the models arrive.
>
> **Other teams — don't block.** Medpsy needs `chat_template` and a `base`-vs-`chat` model distinction; both are JSON. Their judges need profiles of their own — CompassJudger-2-32B and gpt-oss-20b at TP=8 — which under Section 5 are just ordinary serving profiles pointed at by an auxiliary role. VLMEvalKit needs vision preprocessing (`downsample_mode`, pixel caps) and `kv_cache_dtype: fp8`, all JSON, plus something we do not have at all: **a pool of endpoints rather than one**, since they run a server per GPU and load-balance across them. That is Section 11.

---

## 9. Fitting Groups C, D and E into the new shape

The useful test of any schema proposal is whether the hard cases fit. Here is every extra setting those groups need and where it lands.

### Group C — BFCL v3

| What it needs | Where it goes |
|---|---|
| 17 subsets | **`subsets` column** on the standard, hashed. Every team subsets something (Section 6) |
| `temperature: 0.001` | standard's mandated sampling overrides (Section 4) |
| tool-call parser | serving JSON, with an agreed key and a validation rule (Section 6) |
| `keeps_reasoning_history: true` | hashed standard JSON — it changes the score |
| `is_fc_model`, `underscore_to_dot` | hashed standard JSON |
| batch size 64 | operational column, not hashed |

Only one new column. Everything else is JSON or already exists.

### Group D — ACEBench, τ³, ToolSandbox

| What it needs | Where it goes |
|---|---|
| user simulator | auxiliary model (Section 5): checkpoint + sampling profile + serving profile + role, hashed |
| ACEBench `family_modes` (normal→fc, special→prompt, agent→fc) | hashed standard JSON — it changes what the number means |
| `max_dialog_turns: 40` | hashed standard JSON |
| τ³ domain (retail / telecom / banking) | **`subsets`** — this is the only thing distinguishing those four standards |
| τ³ `retrieval_config: golden_retrieval` | hashed standard JSON |
| ToolSandbox `similarity` metric | already fine — the metrics list is per-standard, and 0..1 holds. Needs a leaderboard label |
| pass^k via repeats | `repeats` column already exists |

No new columns beyond `subsets`. The auxiliary model is the whole cost of this group.

### Group E — multi_if, LiveCodeBench

| What it needs | Where it goes |
|---|---|
| `keeps_reasoning_history: false` | same hashed standard JSON as BFCL — and the fact that two benchmarks set it opposite ways is what proves it is a real protocol setting rather than an engine detail |
| 11 languages, 3 turns | reported as subgroups; the metrics list already handles multiple cuts |
| LiveCodeBench `release_v6` | **`subsets`** again |
| code execution sandbox | not a schema question — a runner and security question |

### What this adds up to

Across all three groups: **one new hashed column (`subsets`), three unhashed operational columns, one hashed JSON field on the standard, and the auxiliary model.** Everything else fits what exists. That is a reassuring result — it suggests the JSON-first rule is doing real work rather than just deferring the problem.

> **Tool team — build now.** `subsets`, the operational columns, the hashed standard JSON. That covers Group C completely.
>
> **Other teams — don't block.** The same hashed JSON field absorbs medpsy's per-suite settings (`MMLU_SUBSETS`, `MEDHALLU_SPLIT`, arena battle sample size, cascade extraction on/off) and VLMEvalKit's per-benchmark judge choice. One field, four teams. The exception is medpsy's cascade evaluator, which uses a judge to *extract* an answer before rule-scoring it — that is a second, different use of an auxiliary model in the same run, and it is worth checking that the Section 5 shape allows two auxiliary roles rather than one.

---

## 10. The four hardcoded values

Small, concrete, and quietly blocking about eight of the standards above. `backend/app/services/harness/task_config.py` builds the EvalScope job, and four of its values are constants that should be fields:

```73:77:/home/naresh/TeamRepos/evaluation-service/backend/app/services/harness/task_config.py
        "repeats": recipe.repeats,
        "seed": 42,  # hardcoded, and inert while v1 runs greedy (temperature 0)
        "limit": recipe.sample_limit,
        "eval_batch_size": 32,
        "work_dir": container_work_dir,
```

**`subset_list: ["default"]`** (line 50) — the worst one. Every benchmark gets exactly one subset, always named `default`. Correct for IFEval, wrong for BFCL, τ³, MMLU-Pro and LiveCodeBench. **You cannot express `tau2_retail` at all**, because the only thing distinguishing it from `tau2_telecom` is the subset. Section 9 turns this into a hashed column.

**`eval_batch_size: 32`** (line 76) — how many requests are in flight. The tool-call team measured this and their numbers are worth copying rather than re-deriving: MMLU-Pro went 2,179 tokens/sec at batch 32 to 3,950 at 128, and at 32 the client sets the pace while the GPU idles. Meanwhile ACEBench and BFCL's multi-turn subsets want *16*, because there the bottleneck is Python in the worker, not the endpoint. So 32 is wrong in both directions. Does not change what is measured, so it stays out of the hash.

**`timeout: 1800`** (line 71) — half an hour per request, where AIME25 and MATH-500 need two hours. One generation outliving the client fails the whole task, so this is not a knob to leave at a default and hope.

**`seed: 42`** (line 74) — the comment says it is "inert while v1 runs greedy," which stops being true the moment a thinking standard samples at 0.6, and `ifeval/v1-think` already does. Low urgency, but it should be real before we publish any non-greedy number.

There is also **no per-benchmark job time limit.** Cluster settings live in environment variables by decision D9, fine for one global default and not fine for MMLU-Pro's 24 hours. The tool-call note on this is a real scar worth quoting: they raised it "rather than tuned down, because the alternative is dying at 49% with nothing to show, which is how the old stack lost job 165026."

| Value | Line | In the hash? | Blocks |
|---|---|---|---|
| `subset_list` | 50 | **Yes** | BFCL, all τ³, MMLU-Pro, LiveCodeBench |
| `eval_batch_size` | 76 | No | MMLU-Pro, ACEBench, BFCL (all mis-sized today) |
| `timeout` | 71 | No | AIME25, MATH-500 |
| `seed` | 74 | Probably yes | Reproducibility of any non-greedy run |

> **Tool team — build now.** All four. This is the highest ratio of unblocked-work to effort in the document.
>
> **Other teams — don't block.** All four are universal, so nothing here is tool-specific. Note one-bit-models pins `seed=0` in their model arguments and medpsy runs closed-ended benchmarks three times by default — so `seed` and `repeats` are settings other teams already treat as real, which supports promoting them properly rather than leaving them constant.

---

## 11. What the other teams break that nothing here fixes

Everything above is a schema change. These four are not, and they should be named now so nobody promises a team something the architecture cannot do.

### 11.1 Two of five teams never start a server

We assume the harness talks HTTP to a running model. The `eval_type` is `openai_api`, and a run without an endpoint is not really expressible.

**One-bit-models loads the model inside the harness process.** Their entire flow is `python -m lm_eval --model vllm --model_args "pretrained=...,dtype=bfloat16,data_parallel_size=8,..."`. There is no server, no URL, no port. Their equivalent of a serving profile is a comma-separated argument string, and their equivalent of tensor parallelism is `data_parallel_size=8` with eight lm-eval shards.

**VisionPsy's llama.cpp path is a command-line tool.** They build only `llama-mtmd-cli` and never run `llama-server`, so there is no HTTP endpoint at all — and the model is *two* GGUF files with different quantizations (a Q4_0 language model plus a Q8 vision projector), controlled by `-ngl` layer counts rather than a memory fraction.

This is not a JSON field. It is a second execution mode, and it touches the endpoint table, the reuse logic, the worker, and the compatibility rules. Worth deciding early whether the service supports it or explicitly does not.

### 11.2 One team needs many endpoints, not one

VLMEvalKit starts one vLLM per GPU across all nodes and load-balances across the pool, then repurposes the freed GPUs as judge replicas once inference finishes. Our `endpoint` table holds a single URL per row. A pool is not a bigger endpoint; it is a different thing, with its own health, its own concurrency, and a two-phase lifecycle.

### 11.3 Quantization is sometimes a property of the weights, not the server

For one-bit-models, ternary quantization is baked into the checkpoint by a materialization step *before* evaluation, and vLLM then loads it as ordinary bfloat16 with `quantization=None`. So a serving profile saying `quantization: null` is simultaneously accurate and completely misleading about what is being measured.

We have a `quantization` column on the checkpoint as well as on the profile, and a rule that warns when they disagree. That is the right instinct. But for a team whose entire purpose is comparing quantized models against full-precision baselines, "which quantization" and "compared to which baseline" are the primary axis of the leaderboard, not a footnote. Their manifests carry `tier` and `group` fields for exactly this.

### 11.4 Not every score is between 0 and 1, or higher-is-better

Our `metric.value` is constrained to 0..1. Two real counterexamples: VLMEvalKit's **OmniDocBench reports edit distance, where lower is better**, and MME reports a summed perception-plus-reasoning score that is not a fraction at all. Medpsy's MedSafety reports mean harmfulness, also lower-is-better. We do have `higher_is_better` per metric, which is the important half — but the 0..1 storage constraint would need revisiting before a vision or safety suite lands.

> **Tool team — build now.** Nothing. None of these four affect any tool-call benchmark.
>
> **Other teams — don't block.** These are the four to raise with each team before promising them anything. My honest read: 11.1 is the one that decides whether this is a service for all five repos or for the three that serve over HTTP, and it is worth a deliberate decision rather than a drift.

---

## 12. Suggested order of work

**Step 1 — Unblock the harness builder.** Turn `subset_list`, `eval_batch_size` and `timeout` into fields; decide `seed`. Small, self-contained, prerequisite for most of what follows.

**Step 2 — IFBench and GSM8K.** Two benchmarks, no new infrastructure. Proves the registry is not hardcoded around IFEval, which is the real point of wave 1.

**Step 3 — Fix the serving profile inventory.** Add tool flags to `qwen3` (or rename and add `qwen3-tools`), add the no-parser profile. Two rows, closes the `as_is` hole and unblocks every tool-use benchmark.

**Step 4 — Decide on the recipe split.** Section 4. Do it before there are twenty standards to migrate, not after. The migration is mechanical now and gets worse every standard we add — which is a good argument for doing it before step 5 rather than after.

**Step 5 — GPQA-Diamond and MMLU-Pro.** Needs step 1, plus a per-benchmark job time limit, plus the repeats-and-variance policy GPQA forces.

**Step 6 — BFCL v3.** Agree the `engine_options` key names and write the validation rule first, so the rule exists before the first silently-zero run rather than after.

**Step 7 — Design the auxiliary model.** Section 5. Before any ACEBench or τ³ YAML. Its output is a schema decision, not a standards file. This is also the step that unblocks medpsy, so it is worth doing properly rather than tool-team-shaped.

**Step 8 — Everything else**, roughly in the plan's existing wave order.

AIME25 and MATH-500 sit outside this sequence — cheap once the timeout is a field, but they need the long-context profile and that needs the RoPE question answered with a measurement.

---

## 13. Appendix — reference tables

### 13.1 All 20 tool-call benchmarks

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

### 13.2 Serving flags used across teams

| Flag | Who uses it | Home under Section 6 |
|---|---|---|
| `--reasoning-parser` | tool-call, medpsy, VLMEvalKit | column ✅ |
| `--tensor-parallel-size` | all vLLM teams | column ✅ |
| `--max-model-len` | all | column ✅ |
| `--dtype` | all | column ✅ |
| `--gpu-memory-utilization` | vLLM teams only | column today; no llama.cpp equivalent |
| `--enable-auto-tool-choice` | tool-call | JSON |
| `--tool-call-parser` | tool-call | JSON, agreed key, validated |
| `--tool-parser-plugin` | tool-call (3 families) | JSON — but **nothing ships the file** |
| `--trust-remote-code` | tool-call, medpsy | JSON |
| `--language-model-only` | tool-call, medpsy | JSON |
| `--chat-template` | medpsy, VLMEvalKit | JSON |
| `--mm-processor-kwargs` (pixel caps, downsample) | VLMEvalKit | JSON |
| `--kv-cache-dtype fp8` | VLMEvalKit judge | JSON |
| `--max-num-seqs` | tool-call, one-bit | **no home today** |
| `-ngl`, `--mmproj`, `MTMD_NO_UPSCALE` | visionpsy llama.cpp | JSON — but see Section 11.1 |

### 13.3 Sampling profiles to import

Directly usable as the first `sampling_profile` rows. Our two IFEval standards already match `greedy` and `qwen3_think` exactly, which suggests we copied the right thing the first time.

| Profile | temp | top_p | top_k | other | max_tokens |
|---|---|---|---|---|---|
| `greedy` | 0.0 | — | — | — | 8192 |
| `qwen3_think` | 0.6 | 0.95 | 20 | — | 16384 |
| `qwen3_5_think` | 1.0 | 0.95 | 20 | presence_penalty 1.5 | 32768 |
| `lfm2_5_think` | 0.6 | 0.95 | 20 | — | 16384 |
| `lfm2_5_2_6b` | 0.1 | — | 50 | repetition_penalty 1.1 | 16384 |
| `minicpm5_instruct` | 0.7 | 0.95 | — | — | 8192 |
| `minicpm5_think` | 0.9 | 0.95 | — | — | 16384 |

A note on `presence_penalty: 1.5` in `qwen3_5_think`, because it is easy to think this is blocked and it is not. Their comment says it curbs a repetition loop the small models fall into and is "what makes generation terminate at all" — a real constraint, not a preference. Our builder does forward `presence_penalty`, so it works as intended.

The related confusion is worth clearing up: the comment column in our IFEval YAML wraps across lines and reads as though decision D4 forces `presence_penalty` to `0.0`. It does not. **D4 is about `min_p` and only `min_p`** — the sole entry in `FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS`, because EvalScope's `openai_api` path drops it silently. The neighbouring `presence_penalty: 0.0` is just our own neutral default. And none of the seven profiles above sets a non-zero `min_p`, so importing them all would not trip the D4 warning once.

### 13.4 Auxiliary models across teams

| Team | Role | Model | Sampling | Serving |
|---|---|---|---|---|
| tool-call | user simulator | GLM-5.2 (remote) | max_tokens 1000, thinking off | remote API, key from env |
| tool-call | user simulator | Qwen3.8-27B | max_tokens 1000, thinking off | TP=2, +2 GPUs on the same job |
| medpsy | judge (generic) | CompassJudger-2-32B | **temperature 0.01** | second vLLM, eval phase only |
| medpsy | judge (HealthBench) | per suite | **temperature 0.5** | as above |
| medpsy | judge (arena) | gpt-oss-20b | **temperature 0** | as above |
| VLMEvalKit | judge | Qwen3.6-27B-FP8 as `gpt-4o-mini` | temperature 0, thinking off | one replica per freed GPU, TP=1, kv-cache fp8 |

Three teams, three names, one shape: a checkpoint, a sampling profile, a serving profile, and a role. That is the argument of Section 5 in one table.
