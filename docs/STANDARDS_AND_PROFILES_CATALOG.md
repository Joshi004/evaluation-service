# Standards, Sampling Profiles and Serving Profiles — The v1 Catalog

**Date:** Sep 2026
**Scope:** `evaluation-service` — the precise list to seed, cross-checked against all five team repos: `qvac-research-tool-call`, `qvac-research-medpsy`, `qvac-research-one-bit-models`, `tether_VLMEvalKit`, `qvac-visionpsy-nano`.
**Status:** Companion to [`STANDARDS_AND_PROFILES_RESEARCH.md`](./STANDARDS_AND_PROFILES_RESEARCH.md). That document is the argument — why the recipe should split, why an auxiliary model needs its own table, why a field goes in a column versus JSON. **This document is the output of that argument: names, exact values, and sources, ready to seed.** Nothing here changes code by itself. Where a listed item implies a schema consequence, it's noted in one line with a pointer to the research doc section that already argued it, rather than re-argued here.

Every value below was re-verified against the live repos on the date above (file paths and line numbers included), not copied from the research doc's own citations — a few numbers turned out to need correcting or sharpening in the process, noted inline where that happened.

---

## Table of contents

1. [How to read this document](#1-how-to-read-this-document)
2. [Decision — auxiliary models are called through third-party managed inference endpoints](#2-decision--auxiliary-models-are-called-through-third-party-managed-inference-endpoints)
3. [The shape of an endpoint profile](#3-the-shape-of-an-endpoint-profile)
4. [Sampling profiles — the list to seed](#4-sampling-profiles--the-list-to-seed)
5. [Serving profiles — the list to seed](#5-serving-profiles--the-list-to-seed)
6. [Auxiliary endpoints — the list to seed](#6-auxiliary-endpoints--the-list-to-seed)
7. [Standards — the list to add](#7-standards--the-list-to-add)
8. [Naming conventions, in one place](#8-naming-conventions-in-one-place)
9. [Deferred / explicitly out of scope](#9-deferred--explicitly-out-of-scope)
10. [Open questions this document does not resolve](#10-open-questions-this-document-does-not-resolve)

---

## 1. How to read this document

Each list below has a **source** on every row — which team's config, which file, which line — because a catalog nobody can trace back to evidence is just a list of guesses with better formatting. Three markers appear throughout:

- **Ready to seed.** Grounded in a real, running config from a team repo or already shipped in `standards/`. High confidence.
- **Proposed, needs a decision.** The shape is grounded, but a specific number or substitution is a judgement call this document flags rather than makes unilaterally.
- **Deferred.** Real, but blocked on something outside this catalog's scope (a new harness adapter, a plugin-file story, vision infrastructure).

---

## 2. Decision — auxiliary models are called through third-party managed inference endpoints

### The decision, stated plainly

For every benchmark that needs a second model — a **judge** that grades an answer, a **user simulator** that holds up the other end of a conversation, or an **extractor** that pulls an answer out of free text before rule-scoring it — that second model is reached through a **ready-made inference endpoint operated by a third party**, not served by us. We do not allocate GPUs for it, do not manage replicas, and do not build endpoint-pool machinery for it. We hold the endpoint's connection details and make an HTTP call.

This applies to the three **auxiliary** roles only. It does not change anything about the model *under test* — that stays self-hosted, on our own GPUs, through the existing `serving_profile` machinery in Sections 5 and 6.

### Why this is not a leap — two teams are already doing exactly this

| Team | Role | Model | Provider | `base_url` | Key |
|---|---|---|---|---|---|
| `qvac-research-tool-call` | user simulator (`api_glm5_2`) | `zai-org/GLM-5.2` | W&B Serverless Inference | `https://api.inference.wandb.ai/v1` | `WANDB_API_KEY` |
| `qvac-research-one-bit-models` | judge (MT-Bench, WildBench v2) | `openai/gpt-oss-120b` | W&B Serverless Inference | `https://api.inference.wandb.ai/v1` | `WANDB_API_KEY` |

Sources:

```36:51:/home/naresh/TeamRepos/qvac-research-tool-call/evaluation/configs/user_sim.yaml
# Naming convention: `api_*` = a remote hosted API (needs a key env), `self_*`
# = a model WE host as an OpenAI-compatible vLLM. ...
  api_glm5_2:
    model: zai-org/GLM-5.2
    api_url: https://api.inference.wandb.ai/v1
    api_key_env: WANDB_API_KEY
    max_tokens: 1000
    extra_body:
      chat_template_kwargs:
        enable_thinking: false
```

```50:51:/home/naresh/TeamRepos/qvac-research-one-bit-models/judge/wandb_inference.py
DEFAULT_MODEL = "openai/gpt-oss-120b"
BASE_URL = "https://api.inference.wandb.ai/v1"
```

And a third, independent precedent for the *shape* of the config (not the provider) — `qvac-research-one-bit-models`' `qwen3-Agent-repro` branch already models every model role, including `judge` and `simulator`, as nothing but a `base_url` + `model` + sampling block:

```1:31:/home/naresh/TeamRepos/qvac-research-one-bit-models/configs/models.yaml
# Role -> endpoint mapping. Every model role is an OpenAI-compatible chat endpoint.
roles:
  simulator:
    base_url: ""
    model: "Qwen/Qwen3-32B"
    gen: {temperature: 0.7, top_p: 0.95, max_tokens: 1024}
  judge:
    base_url: ""
    model: "Qwen/Qwen3-32B"
    gen: {temperature: 0.0, top_p: 1.0, max_tokens: 1024}
```

That comment — "every model role is an OpenAI-compatible chat endpoint" — is this decision, written by someone else, for their own reasons, before this document existed.

### What this removes from scope

Two open items from the research doc stop being open, for the auxiliary role specifically:

- **Section 6, "the one hard part."** The research doc's whole difficulty there was hardware: "a self-hosted auxiliary model needs hardware at the same time as the model under test, and the four teams solve it four ways." A third-party endpoint needs none of our hardware, so there's nothing to solve — the provider already scales and load-balances behind one URL.
- **Section 14.2, "two teams need endpoint pools."** That section is about VLMEvalKit's and one-bit's own judge *fleets* — infrastructure they built because they self-host. We are not building a fleet; we are calling one.

What it does **not** remove: an auxiliary call still needs a `sampling_profile` (Section 4.2) so the request is reproducible, and its identity still needs to be recorded and hashed (research doc Section 6, point 1 — "which published scores did a drifted judge produce" is still a real question, just answered by a smaller table).

### The gap this decision opens, and does not close here

Not every judge a team uses today is available from a third party. `CompassJudger-2-32B`, `Gemma4_31B`, medpsy's self-hosted `gpt-oss-20b`, and VLMEvalKit's `Qwen3.6-27B-FP8` (served locally and aliased `gpt-4o-mini`) are all self-hosted, second-vLLM-instance judges today, and I found no evidence any managed provider serves these specific checkpoints — `CompassJudger-2-32B` and the FP8 vision judge in particular are custom/research artifacts, not the kind of model a commercial endpoint carries. Under this decision, each of those roles needs one of:

1. A substitute judge that **is** available on a managed endpoint (e.g. `gpt-oss-120b` via W&B, already proven for MT-Bench), accepting that the substitute's grading behavior may differ from the original and would need its own parity check before publishing anything against it, or
2. A deliberate, scoped exception that keeps self-hosting for that one role.

This document does not pick one — that is a per-suite call for whoever owns HealthBench/vision scoring, not a plumbing decision. Section 6 below lists only the endpoints that are already proven to work; the self-hosted judges are listed separately as **not yet available third-party**, not silently dropped.

### The determinism caveat, said honestly

"Deterministic API call" in the request that prompted this document means: **every field needed to reproduce the request is recorded and hashed** — model, `base_url`, sampling values, extra body. It is not a claim that a commercial endpoint returns byte-identical text twice at temperature 0. Hosted inference stacks batch requests and route MoE experts in ways that can vary run to run, and `DATA_MODEL.md` already makes the same admission about our *own* self-hosted vLLM (`batch size` is deliberately excluded from `profile_hash` for exactly this reason — see that doc's "What's deliberately excluded" table). We record what was sent, not a promise about what comes back.

---

## 3. The shape of an endpoint profile

This is the answer to "what else, besides the endpoint, do we need for a deterministic call" — the fields, and why each one is there. Proposed, not yet implemented; shaped to sit next to `serving_profile` (`app/models/serving_profile.py`, Section 5 below) as a lighter sibling, not a variant of it.

| Field | Hashed? | Why | Example |
|---|---|---|---|
| `label` | No (like `serving_profile.label`) | Human handle; naming a row doesn't change what it does. | `api_glm5_2` |
| `role` | Yes | `judge`, `user_simulator`, or `extractor` (vocabulary from the research doc Section 6 and confirmed real in medpsy's extractor/judge split — Section 6 below). | `user_simulator` |
| `provider` | No — descriptive only | Free text for the UI and for grouping in a rate-limit policy later. The real identity is `base_url` + `model`, not this label. | `wandb_inference` |
| `model` | Yes | The exact string sent as `"model"` in the request body. For a genuine third-party endpoint this **is** the honest identity — there is no aliasing problem here the way there is for a self-hosted judge borrowing an OpenAI name (research doc Section 6's "alias problem"), because we call the provider's own model id directly. | `zai-org/GLM-5.2` |
| `base_url` | Yes | Where the request goes. | `https://api.inference.wandb.ai/v1` |
| `protocol` | Yes | Fixed to `openai_chat_completions` for v1 — every endpoint found across every team, including the genuinely third-party ones, speaks this wire format. Simplest working choice; nothing observed needs another one yet. | `openai_chat_completions` |
| `api_key_env` | No (operational, like `serving_profile`'s absence of secrets) | The **name** of the environment variable holding the key — never the value, since these configs are committed. Matches every team's own convention. | `WANDB_API_KEY` |
| `sampling_profile_id` | Yes (by the referenced profile's own content) | Reuses the same `sampling_profile` concept as the model under test (Section 4) — a judge or simulator is described by exactly the same three things research doc Section 6 names: which model, how it samples, how it's reached. | → `judge_deterministic` |
| `extra_body` | Yes | JSON escape hatch for provider quirks — the one real example found is `chat_template_kwargs: {enable_thinking: false}`, needed by every simulator config seen. Same "column or JSON" rule as Section 7 of the research doc: one team's (well, every team's) quirk, JSON. | `{"chat_template_kwargs": {"enable_thinking": false}}` |
| `timeout_seconds` | No (operational, like `eval_batch_size`) | One-bit's own remote-endpoint probe uses `timeout=120`; tool-call leaves it to the harness's general request timeout (1800s default). Proposed default: `120` for the initial connectivity check the run already has to do, harness request timeout unchanged otherwise. | `120` |
| `max_retries` | No (operational) | Not found pinned by either remote-API integration directly, but VLMEvalKit's generic `OpenAIWrapper` — provider-agnostic, works against a real endpoint or a local one — defaults to `retry: int = 5`. Proposed as the starting default for the same reason: it's the one number in any team's code written for exactly this kind of call. | `5` |

What's deliberately **not** here, compared to `serving_profile`: `engine`, `engine_version`, `gpus`, `tensor_parallel_size`, `pipeline_parallel_size`, `dtype`, `quantization`, `gpu_memory_utilization`. None of them apply — we are not starting a server.

`api_key_env`, `timeout_seconds` and `max_retries` are excluded from the hash for the same reason `eval_batch_size` and `timeout` are excluded from `recipe_hash` today (`task_config.py` and the research doc Section 13): they don't change what's being measured, only how reliably we reach it.

---

## 4. Sampling profiles — the list to seed

### 4.1 For the model under test

Directly usable as `sampling_profile` rows once Section 5 of the research doc ships. Values re-verified against `qvac-research-tool-call`'s actual `configs/models.yaml` (not just the research doc's own appendix), and — where tool-call's profile is partial — filled to a complete row with vLLM's own neutral defaults, exactly as `standards/ifeval-v1-instruct.yaml` already does today for `greedy`.

| Label | temperature | top_p | top_k | min_p | presence_penalty | repetition_penalty | max_tokens | Source |
|---|---|---|---|---|---|---|---|---|
| `greedy` | `0.0` | `1.0`* | `-1`* | `0.0`* | `0.0`* | `1.0`* | `8192` | tool-call sets only temp+max_tokens; starred fields are neutral vLLM defaults — **already shipped verbatim** in `standards/ifeval-v1-instruct.yaml` |
| `qwen3_think` | `0.6` | `0.95` | `20` | `0.0`* | `0.0`* | `1.0`* | `16384` | tool-call `models.yaml:52-57`; starred fields neutral — matches `standards/ifeval-v1-think.yaml` almost exactly |
| `qwen3_5_think` | `1.0` | `0.95` | `20` | `0.0` | `1.5` | `1.0`* | `32768` | tool-call `models.yaml:37-45`. `presence_penalty: 1.5` is load-bearing — their own comment: "what makes generation terminate at all" for the small SKUs |
| `lfm2_5_think` | `0.6` | `0.95` | `20` | `0.0`* | `0.0`* | `1.0`* | `16384` | tool-call `models.yaml:59-64` |
| `lfm2_5_2_6b` | `0.1` | `1.0`* | `50` | `0.0`* | `0.0`* | `1.1` | `16384` | tool-call `models.yaml:66-70` |
| `minicpm5_instruct` | `0.7` | `0.95` | `-1`* | `0.0`* | `0.0`* | `1.0`* | `8192` | tool-call `models.yaml:72-76` |
| `minicpm5_think` | `0.9` | `0.95` | `-1`* | `0.0`* | `0.0`* | `1.0`* | `16384` | tool-call `models.yaml:78-80` |

\* neutral fill, not set by tool-call's own (partial) profile.

**Two "profiles" that must not become profiles.** BFCL's `temperature: 0.001` and AIME25/MATH-500's `max_tokens: 81920` are **standard-mandated overrides**, applied on top of whichever profile the checkpoint uses, per the three-layer resolution the research doc's Section 5 already specifies (and which tool-call's own `sampling_overrides` mechanism implements: `context.py:64-89` resolves `model profile < benchmark requirement < command line`, confirmed verbatim). They belong to the standards in Section 7, not to this table.

### 4.2 For auxiliary roles (judge / user simulator / extractor)

No equivalent table exists yet anywhere — this is new, built from the temperatures each team actually runs its second model at. Two real precedents disagree slightly on `max_tokens` for a judge (one-bit's `1024` vs. medpsy's `2048`); both are cited rather than silently picking one.

| Label | Role | temperature | top_p | max_tokens | enable_thinking | Source |
|---|---|---|---|---|---|---|
| `judge_deterministic` | `judge` | `0.0` | `1.0` | `1024` | n/a (text judge) | one-bit `qwen3-Agent-repro` branch, `configs/models.yaml:24-27` (`judge: gen: {temperature: 0.0, top_p: 1.0, max_tokens: 1024}`) — same value independently confirmed by medpsy's arena judge (`OC_JUDGE_TEMPERATURE: "0"`, `suites.yaml:105`) and by one-bit's MT-Bench judge (`mtbench_run.py:257-258`, fixed `temperature=0.0`) |
| `judge_extract_low` | `extractor` | `0.01` | `1.0`* | `2048` | n/a | medpsy `generic_llm_evaluator.py:227` (`temperature=0.01`, the cascade's "LLM-as-a-parser" default) — `max_tokens` matched to medpsy's own consistent `2048` across every auxiliary call (see `judge_rubric_mid` below); MEDEC's own dedicated extractor uses `0.0` instead of `0.01` for the same role (`medec.py:662-667`) — a real, small inconsistency inside medpsy itself, flagged rather than smoothed over |
| `judge_rubric_mid` | `judge` | `0.5` | `1.0`* | `2048` | n/a | medpsy `chat_completion_sampler.py:29` (`temperature: float = 0.5`, the class default), used **unmodified** by `healthbench.py:507-511`'s grader instantiation |
| `simulator_default` | `user_simulator` | `0.0` | `1.0`* | `1000` | `false` | tool-call `tau3.py:138` hardcodes `{'temperature': 0.0}` for the simulator call; `max_tokens: 1000` + thinking off is the shared pattern in both `api_glm5_2` and `self_qwen3_8_27b` (`user_sim.yaml:36-92`). ACEBench's own upstream simulator call instead hardcodes `temperature=0.001, top_p=1, max_tokens=1000` (`patches.py:632-633`) — close enough to treat as the same profile with a standard-mandated override, per the same three-layer rule as BFCL's `0.001` |

\* no citation found pinning `top_p` for this call; carried at vLLM's neutral default rather than left unset, same discipline as `greedy`'s starred fields above.

---

## 5. Serving profiles — the list to seed

Self-hosted only — this section is entirely about the model *under test*. All five are additions on top of the one profile that exists today; none require deleting or renaming it, correcting an ambiguity in the research doc's own Section 11 (which floated renaming `qwen3` as one option). The current committed row, for reference, re-read from the live migrations:

| Field | Current `qwen3` value | Source |
|---|---|---|
| `engine` / `engine_version` | `vllm` / `0.19.0` | `a961c4064d9c` |
| `tensor_parallel_size` / `pipeline_parallel_size` | `1` / `1` | schema default |
| `max_model_len` | `32768` | raised from `8192` by `d1c7b5104d76` — the original value left no room for `ifeval/v1-think`'s `max_tokens: 16384` |
| `reasoning_parser` | `qwen3` | `a961c4064d9c` |
| `dtype` / `quantization` | `auto` / `null` | schema default |
| `gpu_memory_utilization` | `0.85` | `a961c4064d9c` |

It carries **no** tool-call-parser flags — fine for the two shipped IFEval standards, wrong the moment anything from Tier 2/3 in Section 7 runs against it.

| # | Label | Changes vs. `qwen3` | Why | Source |
|---|---|---|---|---|
| 1 | `qwen3-tools` | `+ --enable-auto-tool-choice --tool-call-parser hermes` | BFCL, ACEBench, τ² / τ³, ToolSandbox — without this vLLM returns a function call as prose and every tool benchmark scores 0 | tool-call `families.yaml:43-49`, the `qwen3` **family** (not to be confused with our profile of the same name) |
| 2 | `qwen3-plain` | `reasoning_parser: null` | The only profile that can satisfy `think_handling: as_is` — today's one profile always carries a reasoning parser, so `as_is` is a setting the schema accepts and the system can never run. One row closes it. | research doc Section 11, confirmed still true against the live `serving_profile.reasoning_parser` column |
| 3 | `qwen3-longctx` | `max_model_len` raised for an 81,920-token completion budget | AIME25, MATH-500 | tool-call `aime25.py:48`, `math_500.py:28` (`sampling_overrides: {'max_tokens': 81920, 'timeout': 7200}`). **Unresolved before seeding**: the reference checkpoint's own `max_seq_len` is `40960` — 81,920 completion tokens plus even a small prompt roughly doubles it, which means RoPE scaling, not just a bigger number. Measure against a known AIME score before picking a value; this row should not ship with a guessed context length. |
| 4 | `qwen3_5-tools` | `--tool-call-parser qwen3_xml --language-model-only --gdn-prefill-backend triton` | The Qwen3.5 catalog is served this way | tool-call `families.yaml:25-41` (`qwen3_5` family — verbatim, including the note that `triton` trades prefill speed for avoiding a FlashInfer JIT-cache hang across venvs) |
| 5 | `qwen3-tp2` | `gpus: 2`, `tensor_parallel_size: 2` | Any self-hosted model-under-test above ~8B. **Note the research doc's original justification has partly evaporated**: it cited "the 27B simulator two teams now run" as a reason — under Section 2's decision, that simulator is a third-party call, not something we serve. The profile is still worth having for a 27B+ checkpoint someone registers as a candidate to evaluate; it just needs a cleaner reason than the one that motivated it originally. | tool-call `user_sim.yaml:53-92` (`serve.tensor_parallel: 2` — now relevant only as a *precedent for the flag shape*, not as a thing we need to replicate) |

### Deferred (real, but blocked)

| Profile | Blocked on |
|---|---|
| `lfm2` / `minicpm5` / `functiongemma` tool-parser families | `--tool-parser-plugin` needs a plugin **file** present on the compute node. Tool-call expands `${EVAL_HOME}` to their own checkout; we have no equivalent path and no story for shipping a plugin file to the cluster. Design work, not config — research doc Section 11. |
| Vision serving (e.g. a `qwen3vl-vision`-shaped profile with `mm-processor-kwargs`, `kv_cache_dtype: fp8`) | Its own wave (Section 9 below) — needs the dataset-volume decision and the endpoint-pool question (research doc Sections 9 and 14.2) settled first. |

---

## 6. Auxiliary endpoints — the list to seed

Using the shape from Section 3. Both rows below are **proven** — real teams are already calling these exact endpoints for evaluation today, which is the entire argument for Section 2.

| Label | Role | `model` | `base_url` | `api_key_env` | Sampling | Source |
|---|---|---|---|---|---|---|
| `api_glm5_2` | `user_simulator` | `zai-org/GLM-5.2` | `https://api.inference.wandb.ai/v1` | `WANDB_API_KEY` | `simulator_default` | tool-call `user_sim.yaml:36-51` |
| `api_gptoss_120b` | `judge` | `openai/gpt-oss-120b` | `https://api.inference.wandb.ai/v1` | `WANDB_API_KEY` | `judge_deterministic` | one-bit `judge/wandb_inference.py:50-51`, invoked at `eval/bench_dense17.sbatch:59-60` (`--judge-model openai/gpt-oss-120b`) |

### Not yet available third-party — flagged, not resolved

These are real, currently self-hosted, and have **no** confirmed third-party equivalent. Listed so the gap is visible rather than silently dropped (see Section 2's open item).

| Model | Current role | Currently served by | Why it's not a quick substitution |
|---|---|---|---|
| `CompassJudger-2-32B` | extractor (closed-ended cascade fallback) | medpsy, second vLLM, eval phase only (`judges.models.yaml:10-18`) | An OpenCompass-specific judge checkpoint; not the kind of model a commercial endpoint carries |
| `Gemma4_31B` | judge (HealthBench rubric grading) | medpsy, second vLLM (`baseline.models.yaml:79-90`) | Same — no evidence of managed hosting |
| `gpt-oss-20b` (medpsy's copy) | judge (safety, arena, smoke) | medpsy, self-hosted, `tensor_parallel_size: 8` (`judges.models.yaml:46-56`) | The model itself may well be hostable (its 120B sibling already is, via W&B) — but this is a substitution decision for whoever owns medpsy's suites, not a plumbing one |
| `Qwen3.6-27B-FP8` (aliased `gpt-4o-mini`) | judge (VLMEvalKit MCQ/YORN scoring) | VLMEvalKit, self-hosted, one replica per freed GPU (`eval.slurm:345-363`) | Served under a borrowed OpenAI name specifically so existing code paths work against it — a real third-party endpoint wouldn't need the alias, but also isn't known to serve this exact FP8 checkpoint |

---

## 7. Standards — the list to add

### How these are shaped, and one consequence worth flagging up front

Every new standard below is specified as **protocol only** — no `-think` / `-instruct` suffix baked in — on the assumption that Section 5's split (research doc) ships before these do. Concretely: `enable_thinking` moves to the **sampling profile** (Section 4), while `think_handling` (strip / as-is / disallow — a scoring decision, not a speaking decision) stays part of the **standard**, alongside everything else that changes what's being measured. One direct consequence: once the split ships, the two standards that exist today — `ifeval/v1-instruct` and `ifeval/v1-think` — are the same standard run under two different sampling profiles, not two standards. This document doesn't migrate them (that's a decision for whoever implements the split, not a side effect of adding new benchmarks), but it's worth knowing before writing the sixth or seventh `-think` variant by hand.

Each tier below states its **framework prerequisite** up front, because that's the real gate on when a tier can start, not the benchmark count.

### Tier 0 — already shipped

| Standard | Benchmark | Framework |
|---|---|---|
| `ifeval/v1-instruct` | IFEval | EvalScope |
| `ifeval/v1-think` | IFEval | EvalScope |

### Tier 1 — rule-scored, no auxiliary model, EvalScope (ready to seed)

| Standard (proposed) | EvalScope `task_name` | Few-shot | Extraction | Primary metric | Notes | Source |
|---|---|---|---|---|---|---|
| `ifbench/v1` | `ifbench` | — | rule-based checkers | `prompt_level_strict` | Same 4 metrics/checkers as IFEval; no row needed in tool-call's own config because it matches every default | tool-call `suites.yaml` (`instruction_following`) |
| `gsm8k/v1` | `gsm8k` | `4` | `\boxed{}` number | `accuracy` | First standard needing a real extraction step — verify the exact key against a live run rather than assuming | tool-call `benches.yaml`; EVAL_SERVICE_PLAN.md §5's own worked GSM8K example |
| `gpqa_diamond/v1` | `gpqa_diamond` | `0` (CoT) | choice + CoT | `accuracy` | 198 questions — forces the repeats/variance policy (95% CI ≈ ±6.8 pts at n=198) | tool-call per-benchmark table |
| `mmlu_pro/v1-full` | `mmlu_pro` | `5` | `ANSWER: [LETTER]` | `accuracy` | 14 subjects, full benchmark. Collides with medpsy's health-only slice — see Tier 5; `subsets` is what keeps these two honest rather than duplicate | tool-call per-benchmark table |
| `aime25/v1` | `aime25` | `0` (CoT) | boxed, symbolic grade | `accuracy` | 30 problems — unreadable without `repeats` ≥ 8. Needs `qwen3-longctx` (Section 5, unresolved) + `sampling_overrides: {max_tokens: 81920, timeout: 7200}` | tool-call `aime25.py:48` |
| `math_500/v1` | `math_500` | `0` (CoT) | boxed, symbolic grade | `accuracy` | 500 problems, same budget/timeout as AIME25 | tool-call `math_500.py:28` |

### Tier 2 — needs harness fixes, still rule-scored, EvalScope

| Standard (proposed) | EvalScope `task_name` | Subsets | Notes | Source |
|---|---|---|---|---|
| `bfcl_v3/v1` | `bfcl_v3` | 17 — confirmed count: `simple/java/javascript` (3) + `multiple/parallel/parallel_multiple/irrelevance` (4) + 6 `live_*` + 4 `multi_turn_*` = 17 | Needs `subset_list` to be a real field (today hardcoded to `["default"]`), `qwen3-tools` (Section 5), and `keeps_reasoning_history: true` + `is_fc_model`/`underscore_to_dot` in a hashed standard JSON field. `temperature: 0.001` is a standard-mandated override on top of whatever sampling profile the checkpoint uses. Batch size 64, not the current hardcoded 32 (tool-call's own measurement: 2,179→3,950 tok/s going 32→128, flattening past 64) | `bfcl_v3.py:59-75` (subsets), `:90-99` (override + reasoning history), `:101-117` (extra_params), `benches.yaml:71-79` (batch size) |

### Tier 3 — needs a third-party auxiliary endpoint (Section 6), EvalScope

| Standard (proposed) | Auxiliary role | Endpoint | Notes | Source |
|---|---|---|---|---|
| `acebench/v1` | `user_simulator` | `api_glm5_2` or `self_qwen3_8_27b`-equivalent | Per-family FC/prompt protocol; `family_modes` and `max_dialog_turns` are hashed standard JSON | tool-call `acebench.py:94-113` |
| `tau2_retail/v1` | `user_simulator` | `api_glm5_2` | `subsets: [retail]` is what distinguishes this from the two below | tool-call `suites.yaml` core |
| `tau2_telecom/v1` | `user_simulator` | `api_glm5_2` | `subsets: [telecom]` | tool-call `suites.yaml` core |
| `tau3_banking/v1` | `user_simulator` | `api_glm5_2` | `subsets: [banking_knowledge]`; `retrieval_config: golden_retrieval` is hashed standard JSON | tool-call `suites.yaml` core |
| `tau2_airline/v1` *(optional)* | `user_simulator` | `api_glm5_2` | Opt-in even in tool-call's own suite; add only if a team asks | tool-call `suites.yaml` (`tau2_airline`, opt-in) |
| `tool_sandbox/v1` | `user_simulator` | `api_glm5_2` | Reports `similarity`, not `accuracy` — needs a leaderboard label so it isn't read as a worse accuracy number | tool-call `tool_sandbox.py:71-77` |

### Tier 4 — hardest tool-call items, EvalScope

| Standard (proposed) | Notes | Source |
|---|---|---|
| `multi_if/v1` | 4,501 samples × 3 turns × 11 languages — largest workload, not conceptually hard. `keeps_reasoning_history: false` (opposite of BFCL's `true` — real proof this is a protocol setting, not an engine default) | tool-call `suites.yaml` core |
| `live_code_bench/v1` | Executes generated code. Tool-call runs with the sandbox off (no Docker on their nodes); we run the harness in a container on the control plane — different security posture, needs its own decision before this ships | research doc Group E |

### Tier 5 — medpsy's 18 (+1), needs an OpenCompass framework adapter

Medpsy is the **owning team** for medical suites (research doc Section 8's precedence rule #1), so OpenCompass is canonical for all of these regardless of what any other harness might also support. This is a new `framework` row for us, not an EvalScope task.

**5a — rule/cascade-scored** (extractor role only, fallback path; most samples never call a model at all):

| Standard (proposed) | Notes | Source |
|---|---|---|
| `medqa/v1` | Cascade: `RegexAnswerEvaluator` first, `GenericLLMEvaluator` (`judge_extract_low`) on fallback | `MedQA_cascade_gen_extraction_only.py:28-70` |
| `medmcqa/v1` | Same cascade pattern | `configs/datasets/README.md` |
| `medxpertqa/v1` | Expert-level medical MCQ | ″ |
| `afrimedqa/v1` | Pan-African multi-specialty medical QA | ″ |
| `mmlu/v1-health` | 6 medical subjects only. **Collides with one-bit's full `mmlu`** (Tier 6) — two honest standards over one dataset once `subsets` is real, per research doc Section 8's own resolution of this exact pair | research doc §8 |
| `mmlu_pro/v1-health` | Health category only. **Collides with tool-call's full `mmlu_pro`** (Tier 1) — same resolution | research doc §8 |
| `pubmedqa/v1` | Biomedical literature yes/no/maybe | `configs/datasets/README.md` |
| `toxigen/v1` | Implicit hate speech detection | ″ |
| `medhallu/v1` | Medical hallucination detection | ″ |
| `medhallu_knowledge/v1` | MedHallu with knowledge context | ″ |

Registered extractor for this group: `CompassJudger-2-32B` today (self-hosted — see Section 6's open gap).

**5b — judge-scored** (needs the third-party judge decision from Section 6):

| Standard (proposed) | Judge today | Sampling | Source |
|---|---|---|---|
| `healthbench/v1` | `Gemma4_31B` | `judge_rubric_mid` (temp `0.5`, unmodified default) | `healthbench.py:507-511`, `chat_completion_sampler.py:29` |
| `healthbench_professional/v1` | `Gemma4_31B` | `judge_rubric_mid` | `suites.yaml:44-46` |
| `medsafety/v1` | `gpt-oss-20b` | `judge_deterministic`-ish (suite default temp `0`, per `safety` suite) | `suites.yaml:48-50` |
| `medicationqa/v1` | `gpt-oss-20b` | (suite default) | `configs/datasets/README.md` |
| `healthsearchqa/v1` | `gpt-oss-20b` | (suite default) | ″ |
| `expertqa_healthcare_medicine/v1` | `gpt-oss-20b` | (suite default) | ″ |

**5c — special storage, not just a harness setting:**

| Standard (proposed) | Why it's special | Source |
|---|---|---|
| `medec_p1/v1` | Dataset is **not on any public hub** — loads from `${COMPASS_DATA_CACHE}/MEDEC` (default `$HOME/.cache/opencompass/MEDEC`), populated by `setup_medec_data.sh`. Stage-3 metrics need **cached scoring models** too: BERTScore (`microsoft/deberta-xlarge-mnli`) and BLEURT-20, warmed by `setup_medec_metrics.sh`. Optional LLM extractor at `MEDEC_LLM_EXTRACT=true`, hardcoded `temperature=0.0` (not `judge_extract_low`'s `0.01` — a real, cited difference) | `medec.py:150-152,662-667`; `setup_medec_data.sh:6-7`; `setup_medec_metrics.sh:27-29,43-48` |
| `medec_p2/v1` | Same, few-shot variant | ″ |

**5d — a different kind of result, flagged rather than speced:**

`open_ended_arena` — pairwise judging, `gpt-oss-20b` per `suites.yaml:67` (README instead names `Qwen3.6-35B-A3B` at line 407 — an unresolved discrepancy in medpsy's own docs, flagged rather than picked), temperature `0` via `OC_JUDGE_TEMPERATURE`. This is arena-style, not a 0..1 accuracy metric, and per `EVAL_SERVICE_PLAN.md`'s own wave ordering ("Arena / pairwise — a different *kind* of result; needs its own storage and its own view") it does not fit this catalog's standard shape at all. Not counted in the "18."

### Tier 6 — one-bit-models' classic suite, needs an lm-eval 0.4.12 adapter

| Standard (proposed) | lm-eval task | Notes | Source |
|---|---|---|---|
| — | `ifeval`, `gsm8k`, `gpqa_diamond_zeroshot`, `minerva_math500` | **Collision — do not duplicate.** Canonical is already tool-call/EvalScope (incumbent + owner, research doc §8's tie-break). Reuse `ifeval/v1-*`, `gsm8k/v1`, `gpqa_diamond/v1`, `math_500/v1`. One-bit is the team that eventually migrates, per research doc §8, once the lm-eval adapter exists to compare against | one-bit `scripts/mock_eval_results.py:11-30` |
| `mmlu/v1-full` | `mmlu` | Full benchmark, distinct `subsets` from medpsy's `mmlu/v1-health` (Tier 5a) — not a collision once `subsets` is real | ″ |
| `mmlu_redux_generative/v1` | `mmlu_redux_generative` | No collision found | ″ |
| `boolq/v1` | `boolq` | | ″ |
| `hellaswag/v1` | `hellaswag` | | ″ |
| `piqa/v1` | `piqa` | | ″ |
| `winogrande/v1` | `winogrande` | | ″ |
| `openbookqa/v1` | `openbookqa` | | ″ |
| `arc_easy/v1` | `arc_easy` | | ″ |
| `arc_challenge/v1` | `arc_challenge` | | ″ |
| `truthfulqa_mc1/v1` | `truthfulqa_mc1` | | ″ |
| `truthfulqa_mc2/v1` | `truthfulqa_mc2` | | ″ |
| `humaneval_plus/v1` | `humaneval_plus` | Code execution — same security-posture question as `live_code_bench` (Tier 4) | ″ |
| `mbpp_plus/v1` | `mbpp_plus` | Same | ″ |
| `leaderboard_musr/v1` | `leaderboard_musr` | | ″ |

**One-bit's newer work** (not lm-eval; needs a third-party judge, Section 6):

| Standard (proposed) | Judge | Notes | Source |
|---|---|---|---|
| `mt_bench/v1` | `api_gptoss_120b` | Per-category generation temperature (`0.0`/`0.1`/`0.7` mapped to coding-math-reasoning / humanities-stem / roleplay-writing) is a **standard-mandated override**, not a profile — same pattern as BFCL | `mtbench_run.py:12-14,37,64-70,149,257-258` |
| `wildbench_v2/v1` | `api_gptoss_120b` | Judged the same way, per one-bit's own `eval/wildbench_run.py` | one-bit `ternary-qat-rl` branch |

τ-bench-style slices found in one-bit's own `eval/tau_slice_*.sbatch` scripts should converge onto Tier 3's `tau2_*`/`tau3_*` standards rather than becoming separate ones — one benchmark, one harness (research doc §8). `pass@k` is `repeats` plus aggregation on an existing standard, not a new one (research doc §12).

### Tier 7 — vision, VLMEvalKit, own wave (deferred, catalogued for completeness)

Deferred per Section 9, but "check all teams" means this needs a real count, not a placeholder. The board's own README says **22 main benchmarks plus 39 CCOCR subsets (23 logical benchmarks, 61 run units)** — the script that actually runs today (`eval_board.sh:34-56`) lists **63** (includes `MMIU` and `BabyVision`, which the README total doesn't account for). Flagging the discrepancy rather than silently picking a number:

| Group | Benchmarks | Notes |
|---|---|---|
| Main (24, non-OCR-family) | `AI2D_TEST`, `BLINK`, `ChartQA_TEST`, `DocVQA_VAL`, `InfoVQA_VAL`, `MM-IFEval`, `MMBench_DEV_EN_V11`, `MME`, `MME-RealWorld-Lite`, `MMMU_DEV_VAL`, `MMStar`, `MMVet`, `MUIRBench`, `MathVista_MINI`, `OCRBench`, `OCRBench_v2`, `OmniDocBench`, `POPE`, `RealWorldQA`, `SEEDBench_IMG`, `ScienceQA_TEST`, `TextVQA_VAL`, `MMIU`, `BabyVision` | `eval_board.sh:36-40,55` |
| CCOCR (1 logical family, `subsets`) | 39 subsets across `DocParsing` / `Kie` / `MultiLanOcr` / `MultiSceneOcr` | `eval_board.sh:41-54` — exactly the `subsets`-as-a-real-field case research doc §12 already argues for |

**Exist in the repo, not in the default board — do not add yet:** `WildDoc`, `MMRB`, `RefCOCO`, `ST-VQA`, `VLM2Bench` (all have adapters, none are wired into `eval_board.sh`), and `Video-MME` (configs exist in `video_dataset_config.py`, explicitly not in the default suite).

**Metric-shape flags**, needed before any of these can use the current `metric.value` column: `OmniDocBench` reports `overall_EN` as an edit distance ×100, **lower is better** (`collect_board.py:58-62`); `MME` reports `perception + reasoning`, a summed non-fraction score (`collect_board.py:81-85`); `BabyVision` is already 0–100 and explicitly must **not** go through the generic "≤1.0 is a fraction, ×100" rule (`collect_board.py:74-79` has a comment saying exactly this, because sub-2B models legitimately score below 1.0). This is research doc §14.4's open item, now with three concrete offenders instead of two.

**Judge**: `Qwen3.6-27B-FP8` aliased `gpt-4o-mini`, self-hosted — see Section 6's open gap. No third-party equivalent confirmed.

---

## 8. Naming conventions, in one place

| Thing | Convention | Example | Source |
|---|---|---|---|
| Standard | `benchmark/vN[-variant]` | `ifeval/v1-think`, `bfcl_v3/v1` | already shipped (`standards/*.yaml`) |
| Serving profile (self-hosted) | short, capability-named, not team-named | `qwen3-tools`, not `tool-qwen3` | research doc §11 — content-addressed, so two teams needing the same flags get the same row |
| Sampling profile | as imported from source, lowercase + underscores | `qwen3_think`, `lfm2_5_2_6b` | tool-call `models.yaml` |
| Auxiliary endpoint | `api_<short-model-handle>` for a third-party endpoint | `api_glm5_2`, `api_gptoss_120b` | tool-call `user_sim.yaml:24-31` — their own `api_*` / `self_*` convention, adopted directly since Section 2 means we now only need the `api_*` half |

---

## 9. Deferred / explicitly out of scope

| Item | Why |
|---|---|
| `qvac-visionpsy-nano` (llama.cpp / on-device path) | Builds and runs `llama-mtmd-cli` only — confirmed no `llama-server` target, no HTTP endpoint, no API call anywhere in the project layer (only the vendored, unused upstream fork has one). There is nothing to profile: no server means no `serving_profile`. Its own benchmark numbers are produced by being evaluated *as a model under test* inside VLMEvalKit (its README says exactly this — 17 public benchmarks, "all scored in a single VLMEvalKit harness"), so it is not a fifth evaluating flow with its own standards; it's a checkpoint family that shows up in Tier 7. This matches research doc §14.1's framing exactly — a scope decision, not a schema gap. |
| Plugin-parser serving profiles (`lfm2`, `minicpm5`, `functiongemma`) | Section 5 — blocked on a plugin-file distribution story we don't have yet. |
| Vision serving profiles, vision endpoint pools | Section 5/7 — the dataset-volume decision (research doc §9) and the endpoint-pool question (research doc §14.2, now proven necessary by two teams) both need to land first. |
| Self-hosted judges without a third-party substitute | Section 6 — a per-suite product decision, not something this catalog resolves. |

---

## 10. Open questions this document does not resolve

1. **Substitute or exception, per self-hosted judge.** `CompassJudger-2-32B`, `Gemma4_31B`, medpsy's `gpt-oss-20b`, VLMEvalKit's vision judge — each needs an owner to pick one of Section 2's two paths. Doing this by fiat here would be deciding a HealthBench/vision scoring question with no domain input, which this document isn't positioned to do.
2. **`qwen3-longctx`'s actual `max_model_len`.** Flagged in Section 5 as needing measurement against a known AIME score before a number ships — RoPE scaling is a quality trade-off, not a config value.
3. **Whether `api_key_env` belongs in the endpoint-profile hash at all.** This document excludes it (Section 3), reasoning by analogy to `serving_profile`'s existing operational exclusions. Worth a second opinion before it's load-bearing.
4. **Sequencing of the two new framework adapters.** Tier 5 (medpsy) needs OpenCompass; Tier 6 (one-bit) needs lm-eval. Both are real work, neither is in this catalog's scope to schedule — that's `EVAL_SERVICE_PLAN.md`'s job (its own wave table already orders medpsy at wave 4 and the VLM suite at wave 6, but doesn't mention the lm-eval-only tier explicitly).
5. **`open_ended_arena`'s judge**, `gpt-oss-20b` per `suites.yaml` versus `Qwen3.6-35B-A3B` per medpsy's own README — a discrepancy in their docs, not ours, but worth them confirming before it's load-bearing for us.
