# Where We Actually Stand — An Honest Look at the Unified Evaluation Service

**Date:** Sep 2026
**What this is:** a status and gap analysis. It describes how the teams evaluate today, what the unified service has actually built, what it hasn't, and how far it is from two specific goals:

1. **Do everything the tool-call (agent) team does for evaluation.**
2. **Be able to take on benchmarks from the other teams.**

**Companion docs:** [`BENCHMARK_UNIFICATION_RESEARCH.md`](./BENCHMARK_UNIFICATION_RESEARCH.md) (how the teams work) · [`EVAL_SERVICE_PLAN.md`](./EVAL_SERVICE_PLAN.md) (the design) · [`STANDARDS_AND_PROFILES_CATALOG.md`](./STANDARDS_AND_PROFILES_CATALOG.md) (what to seed)

Nothing here changes any code. Everything below comes from reading the repos on disk, not from asking anyone.

---

## Table of contents

1. [The short version](#1-the-short-version)
2. [How each team evaluates today](#2-how-each-team-evaluates-today)
3. [What the unified service is trying to be](#3-what-the-unified-service-is-trying-to-be)
4. [What's actually in the repo right now](#4-whats-actually-in-the-repo-right-now)
5. [What works today, end to end](#5-what-works-today-end-to-end)
6. [What doesn't exist yet](#6-what-doesnt-exist-yet)
7. [Goal 1 — matching the tool-call team](#7-goal-1--matching-the-tool-call-team)
8. [Goal 2 — taking benchmarks from other teams](#8-goal-2--taking-benchmarks-from-other-teams)
9. [Honest criticism](#9-honest-criticism)
10. [What I'd do next, in order](#10-what-id-do-next-in-order)

---

## 1. The short version

The unified service is **much further along than its own README says**, and much further along than a proof of concept. It really does run an evaluation from end to end: you register a checkpoint, pick a benchmark, hit submit, and it SSHes into the cluster, starts a vLLM server, runs EvalScope against it over a tunnel, parses the report, and puts the numbers in Postgres where a leaderboard page reads them. That whole path works. It is genuinely good work.

But it does that for **one framework and five benchmarks**. The tool-call team runs **twenty**. So the honest summary is:

> **We have built the hard part (the machinery) and a small fraction of the easy part (the benchmark coverage).**

The five benchmarks we support — IFEval, IFBench, GSM8K, GPQA-Diamond, MMLU-Pro — are all from the same easy family: rule-scored, single-turn, no second model needed, no special Python environment. They were the right five to start with. But that means everything harder is still ahead, and the things blocking it aren't small config gaps, they're missing pieces of the system:

- **No way to call a second model.** No judge, no user simulator. That single missing table blocks ACEBench, all the τ²/τ³ benchmarks, ToolSandbox, every one of medpsy's judged medical suites, and all of the vision board.
- **No way to run a second framework.** The `framework` field exists on a standard, but nothing reads it to decide anything — the code always uses one hardcoded EvalScope image. So lm-eval, OpenCompass and VLMEvalKit can't be plugged in without a real change to how runs are dispatched.
- **Nothing survives a restart.** Runs live in an in-memory Python dictionary. Restart the backend mid-run and the run is orphaned, the GPU keeps burning until its `--time` expires, and the database still says "running".
- **No historical numbers.** The plan's "Milestone 0" — import the teams' existing results so the leaderboard has something on it on day one — was never built. The leaderboard is empty until someone runs something through us.

The good news: none of these are design mistakes. They're unbuilt work, and the existing design has clean places for all of them to go. The bad news is that the remaining work is bigger than the "add a YAML file per benchmark" story the catalog doc implies.

---

## 2. How each team evaluates today

Five repos, four real evaluation systems, four different frameworks underneath. Nobody coordinated, and yet they converged on a lot.

| Team | Framework | How you start a job | How the model runs | Where results go |
|---|---|---|---|---|
| **tool-call** (agent) | EvalScope, pinned to one commit | `./qvac-eval submit -m Model -b core -c my_run` | vLLM server per job, talked to over HTTP | `summary.json` per run, in a tidy tree |
| **one-bit-models** | lm-evaluation-harness | `python3 scripts/submit_lbe.py config.json` | loaded in-process by lm-eval (vLLM or HF) | `leaderboard.jsonl` + per-run JSON |
| **medpsy** | OpenCompass fork, **plus tool-call's harness via a bridge** | `bash scripts/eval_launcher.sh --suite healthbench` | vLLM inside an enroot container | `summary-latest.csv` + reused `summary.json` |
| **tether_VLMEvalKit** | VLMEvalKit fork | `NODES=3 bash scripts/eval.sh MyModel` | a *pool* of vLLM servers across many GPUs, then judges reuse the same GPUs | `.xlsx` + scattered CSVs, rolled up to `scores.csv` |
| **visionpsy-nano** | none — it's a model repo | n/a | n/a | its numbers come from tether_VLMEvalKit |

**What they already share.** Everyone uses SLURM. Everyone uses vLLM. Nobody wrote their own scorer — they all lean on an existing open-source framework. Everyone names a model with a short tag plus a path. Everyone has a smoke mode. Everyone writes one file per run plus a rolled-up table. That's a big head start: we're not unifying four infrastructures, just four sets of scripts sitting on one.

**What they don't share.** Job shape is genuinely different and for good reasons — tool-call submits one small job per (model, benchmark) cell, VLMEvalKit submits one enormous job that holds 24 GPUs for hours and flips them from serving to judging halfway through. Config format ranges from plain JSON to "edit a Python source file". Result shape ranges from a versioned `summary.json` to a folder of spreadsheets. And each team has its own SLURM partition (`toolCall`, `main`, `VLM`, `health`).

**The thing most worth knowing:** medpsy already built, on their own, exactly the adapter pattern this whole project proposes. They don't reimplement IFEval or BFCL — they translate their model config into tool-call's format and call tool-call's unmodified submit script. That's real evidence the approach works, and it's also why the catalog doc treats tool-call/EvalScope as the canonical owner of IFEval: a team already voted with their code.

---

## 3. What the unified service is trying to be

Two halves, deliberately separated.

**The control plane** is our own server, outside the cluster. FastAPI, Postgres, a React UI, and the harness containers. It holds all the state and all the credentials.

**The compute plane** is the GPU cluster, reached only over SSH. We submit jobs, poll them, read logs, and talk HTTP to model servers through a tunnel. We install nothing there and leave nothing running except the jobs themselves.

The central design idea is that a benchmark score is produced by **three separate things**, each recorded and hashed on its own:

| Layer | What it decides | Example |
|---|---|---|
| **Standard** | The protocol — what question gets asked and how the answer is scored | IFEval: 0-shot, no prompt wrapper, four strict/loose metrics |
| **Sampling profile** | How the model is asked to speak | `qwen3_think`: temperature 0.6, top_p 0.95, thinking on, 16k tokens |
| **Serving profile** | How vLLM is launched | `qwen3-tools`: reasoning parser on, hermes tool parser, 32k context |

Split this way because the protocol *should* be identical for every model, but how a model is sampled legitimately depends on the checkpoint. Forcing greedy decoding on a reasoning model produces a wrong number that the owning team would rightly reject. So the protocol is fixed and the speaking style is chosen, recorded, and hashed — and the leaderboard only ranks numbers that share a hash.

Each of the three is a version-controlled YAML file in `catalog/`, loaded into Postgres and content-addressed. Change a field, get a new hash, get a new row. Old scores keep their old label. Nothing is ever silently relabelled.

This is a good design. It's the right answer to the research doc's number-one risk (two teams both saying "IFEval" and meaning different tests), and it's more careful than anything any individual team does today.

---

## 4. What's actually in the repo right now

```
evaluation-service/
├── backend/          FastAPI control plane — ~9,700 lines of Python
│   ├── app/api/v1/       9 resources: checkpoints, standards, runs, run-groups,
│   │                     leaderboard, endpoints, serving-profiles,
│   │                     sampling-profiles, health
│   ├── app/controllers/  request/response shaping
│   ├── app/services/     the real logic — 14 sub-packages
│   ├── app/models/       9 SQLAlchemy tables
│   └── alembic/          3 migrations
├── frontend/         React + Vite — ~5,800 lines of real app
│   ├── src/pages/        10 pages, all wired to the API
│   └── src/prototype/    ~5,500 lines of fully mocked vision demo, for buy-in
├── catalog/          the version-controlled recipes
│   ├── standards/            5 files
│   ├── sampling-profiles/    7 files
│   └── serving-profiles/     3 files
├── harness/evalscope/    Dockerfile for the EvalScope container + entrypoint
├── docs/             6 documents, ~4,800 lines
└── docker-compose.yml    postgres + backend + frontend + (build-only) harness
```

A few things worth noticing about this layout.

**The service logic is well organised.** `app/services/` is split into fourteen small packages — `cluster`, `harness`, `endpoints`, `runs`, `standards`, `compatibility`, `discovery`, and so on — each with its own narrow job. The cluster connector in particular sits behind a six-method interface (`submit`, `status`, `cancel`, `logs`, `stage_file`, `open_tunnel`) so nothing above it knows SSH is involved. That's exactly the shape that makes a future SLURM REST API an upgrade rather than a rewrite.

**The code comments are unusually good.** They explain *why*, cite the measurement or the bug that motivated a decision, and warn about traps. Someone reading `task_config.py` learns why `enable_thinking` has to be sent per-request and what happened when it wasn't. This is real institutional memory and it should be protected.

**Half the frontend is a mock.** `src/prototype/` is 5,500 lines of a fully simulated vision demo — lineage graphs, radar charts, prediction diffs, confidence intervals — built for management buy-in and clearly labelled as such. It's not connected to anything. Worth knowing before anyone looks at the line count and assumes the product is twice as finished as it is.

**Four design documents referenced 126 times in the code don't exist.** `IMPLEMENTATION_PHASES.md`, `STANDARDS_AND_PROFILES_PHASES.md`, `CHECKPOINT_REGISTRATION_PHASES.md` and `CLUSTER_VALIDATION.md` are cited all over the comments (and two are linked from the README), but none of them are in `docs/`. They were deleted in an earlier cleanup commit. So a new person reading `serve_job.py` — "see Phase 3, Appendix A" — has nowhere to go, and the README's links are broken. One comment even admits it: *"a file that was never committed... says not to look for it."*

---

## 5. What works today, end to end

This is the part that deserves credit. Here's the actual path a run takes, and all of it is implemented.

**1. Register a checkpoint.** The service SSHes to the cluster, walks the model directories, and finds candidate checkpoints. It reads each one's `config.json` and `generation_config.json` and pulls out the architecture, base model, context length, dtype, quantization, shard count and size. It suggests a family. It records a parent checkpoint if you give it one, with cycle detection and a depth cap. It re-checks availability before every run, so a checkpoint that vanished off the filesystem fails fast instead of wasting a GPU allocation.

**2. Validate the combination before submitting.** There's a real compatibility checker. It'll tell you a standard that wants think-stripping needs a serving profile carrying a reasoning parser, or that a sampling field you set will be silently dropped by EvalScope. This doesn't exist in any team's own tooling.

**3. Preview before spending GPU time.** `POST /runs/preview` is the dry run — it shows you exactly which runs would be created and what they'd resolve to, before anything is submitted.

**4. Submit as a group.** A run group is a batch of (checkpoint × standard × profile) cells, the same idea as tool-call's `config_id`. One run per cell.

**5. Get an endpoint.** This is the nicest piece of engineering in the repo. A per-(checkpoint, serving profile) lock means two runs submitted together can't both start a vLLM server for the same model — one starts it, the other waits and reuses it. Given a cold start measured at 350 seconds of H100 time, that's real money saved. The serve script is generated from the serving profile, submitted to SLURM over stdin (so nothing is ever staged on the cluster), derives its port from the job ID to avoid collisions, and — importantly — checks whether the server process is still alive while polling for readiness. Without that check, a server that crashes on a bad flag holds a GPU for the full 900-second timeout. That bug was found during validation and fixed before it could cost anything.

**6. Run the harness.** A fresh Docker container per run, on our own server, pointed at the cluster's vLLM through an SSH tunnel. The image is built from the exact EvalScope commit the tool-call team uses, with the NLTK corpora and all five datasets baked in at build time — so a run can never fail two hours in because a download stalled.

**7. Parse and store.** The report is parsed, metrics land in Postgres as rows (not columns, so adding a benchmark never needs a migration), and the truncation rate is computed. That last one is worth calling out: **no team measures truncation today**, and it's the diagnostic that catches a thinking model being cut off mid-thought and scored on an answer it never produced. The validation run hit 100% truncation on a trivial question. Building this on day one was the right call.

**8. Cancel cleanly.** Cancel writes the status first so the worker can't race it back to "failed", kills the harness container (cancelling the Python task alone wouldn't stop the `docker run` child), and tears down the endpoint only if no sibling run is still using it.

**9. Look at it.** Ten working pages: leaderboard, checkpoint detail, register, standards, sampling profiles, serving profiles, submit, runs, run detail with live logs, endpoints.

That is a working evaluation service. Everything in this section is real.

---

## 6. What doesn't exist yet

Grouped by how much it hurts.

### Hurts now

**No reconciler.** The plan is explicit that runs should be driven by a loop that wakes up every 20 seconds, asks the cluster what's happening in one bulk call, and moves each unfinished run forward one step. What's actually built is the opposite: each run is a long-lived `asyncio` task in an in-process dictionary, holding a database session for the run's entire lifetime. `services/reconciler/__init__.py` is a docstring and nothing else.

The consequence is concrete. Deploy the backend, or have it crash, and every in-flight run is orphaned: the SLURM job keeps running, the GPU keeps burning until `--time` expires, the harness container keeps going, and the database row says `running` forever. There's no startup recovery. This is the single biggest robustness gap, and it's the exact failure the plan warned about.

**No second model, at all.** There is no table for a judge, a user simulator, or an extractor. The catalog doc has already designed one (`role`, `model`, `base_url`, `api_key_env`, a sampling profile, hashed) and already picked two proven third-party endpoints to seed it with. But nothing is built. This one missing table blocks:

- ACEBench and all three of its variants
- τ²-retail, τ²-telecom, τ³-banking, τ²-airline, τ³
- ToolSandbox
- Every judged medpsy suite — HealthBench, MedSafety, the arena
- Every VLMEvalKit benchmark that needs the judge

That's roughly half of everything anyone wants to run.

**Only one framework can actually run.** A standard carries a `framework` field and a `framework_image` field. Both are recorded, both are hashed, and neither is used to decide anything — `runner.py` always uses one global setting, `settings.harness_image`. So the field is descriptive, not dispatching. Adding lm-eval or OpenCompass isn't a matter of writing a YAML file; it needs a real dispatch layer, a second image, and a second result parser.

**No historical data.** The plan's Milestone 0 was to import the teams' existing `summary.json` files so the leaderboard has real rows on day one, marked `legacy`. It was never built. There's no importer anywhere in the backend. The practical effect is that we can't show anyone anything until we've re-run their work ourselves, which is the slowest possible route to adoption.

### Hurts soon

**No confidence intervals.** The `metric` table has `value`, `n_samples` and `is_primary` — but no `stderr`. The plan argues at length that a benchmark score is an estimate from a sample, that IFEval's 95% interval at n=541 is about ±4 points, and that two models three points apart are statistically indistinguishable. All correct, and none of it is in the schema. Error bars can't be added to the UI later without a migration and a backfill.

**No error rate.** Truncation rate is computed; the other half of the diagnostic pair isn't. The harness runs with `ignore_errors: True`, which means a failed request quietly becomes a wrong answer. Without an error rate nobody can tell the difference between a bad model and a flaky endpoint.

**No publish gate, no `is_standard` flag.** The leaderboard's own code says so plainly. Every completed run shows up. There's no "this run was produced by the official recipe" marker and no step between "a job finished" and "this number is on the board", so one broken run corrupts the shared view immediately.

**No suites.** Tool-call has seven named groups (`core`, `fast`, `math`, `tool_use`...) and `-b core` is the single most-typed thing in their workflow. Here you pick standards one at a time.

**No re-scoring.** The plan makes a strong case for storing predictions and re-scoring them when a recipe changes — turning a GPU-week into a few minutes. Tool-call already has this (`--use-cache`, `resummarize`). We don't, and the run state machine has no `scoring → scoring` path.

**No repeats aggregation.** `repeats` exists as a field on a standard, but there's nothing that averages across them or computes pass^k. Without it, AIME25 (30 questions, ±18 point interval) is unreadable.

**No tests.** Zero test files in the whole repo. Tool-call has 23, and they run in a few seconds without a GPU. For a system whose entire product is "this number is trustworthy", that's an uncomfortable gap — especially around hashing, resolution and report parsing, which are pure functions and cheap to cover.

### Deferred on purpose, and fine

**No S3.** `services/s3/__init__.py` is a docstring; `boto3` isn't even a dependency. This is a deliberate and correct sequencing choice — the reference checkpoint is already on the cluster's shared filesystem, so the whole S3 staging path can wait. It's still blocked on a real external dependency: the AWS setup is SSO, which needs a human with a browser, and an unattended service can't do that. Someone needs to ask for a non-interactive identity.

**No auth.** `submitted_by` is a free-text field nobody validates. Fine for now, but note there's no `team` column at all — and the plan's own risk table says retrofitting tenancy is a bad week.

**No lineage graph.** `parent_checkpoint_id` is stored, with proper cycle detection. There's just no UI for it. The prototype has a beautiful mocked version.

---

## 7. Goal 1 — matching the tool-call team

This is the immediate goal, so it's worth being precise about the distance.

### Benchmark coverage: 5 of 20

| | tool-call | unified service |
|---|---|---|
| Registered benchmarks | **20** | **5** |
| Of their default `core` suite (10) | all 10 | **4** — mmlu_pro, gpqa_diamond, ifeval, ifbench |
| Of their `fast` suite (4) | all 4 | **3** — missing bfcl_v3 |

The fifteen we're missing, and what's actually blocking each:

| Missing | Blocked on |
|---|---|
| `bfcl_v3` | Their `_bfcl_force_quit` patch, plus `keeps_reasoning_history` / `is_fc_model` as hashed fields. The 17 subsets and the `qwen3-tools` serving profile are already supported. **Closest to done.** |
| `ceval` | A YAML file plus an image rebuild (see below). **The closest to done.** |
| `aime25`, `math_500` | A long-context serving profile. Its `max_model_len` is an open question — an 81,920-token budget needs RoPE scaling, not just a bigger number. |
| `multi_if` | `keeps_reasoning_history: false` as a hashed field. Large but not hard. |
| `acebench` ×3, `tau2_*` ×3, `tau3*` ×2, `tool_sandbox` | **The missing auxiliary-endpoint table.** Nine benchmarks, one blocker. |
| `live_code_bench` | Executes model-generated code. Needs a separate image and a security decision — tool-call runs it with the sandbox off because their nodes have no container runtime; ours does, which changes the posture. |

### Capability comparison

Where we're behind:

| Capability | tool-call | us |
|---|---|---|
| Named suites (`-b core`) | 7 suites | none |
| Second-model roles | user simulator, wired | nothing |
| Multiple environments | 4 venvs, per benchmark | 1 image |
| Their EvalScope patches | 3 `.patch` files + BFCL force-quit + ToolSandbox adapter | **none applied** |
| Tool-parser plugins | 3 (LFM2, MiniCPM5, FunctionGemma) | none — blocked on getting a plugin file onto a compute node |
| Re-score without GPU | `--use-cache`, `resummarize` | no |
| Report export | `report --format markdown/csv` | no |
| Environment self-check | `doctor` | no |
| Tests | 23 files, seconds to run | 0 |

Where we're **ahead**, and it's genuinely ahead:

| Capability | tool-call | us |
|---|---|---|
| Endpoint reuse across benchmarks | no — one server per cell | **yes**, with locking |
| Results in a queryable database | no — a filesystem tree | **yes** |
| Built-in leaderboard | an external Flask app on shared storage | **yes**, in the product |
| Truncation-rate diagnostic | no | **yes** |
| Compatibility validation before submit | no | **yes** |
| Content-addressed, reviewable recipes | partial (`like:` inheritance) | **yes**, hashed end to end |
| Checkpoint discovery and inspection | manual YAML entry | **yes**, over SSH |

### The patch question is the sharpest one

Our harness image is a clean `pip install` of EvalScope at the pinned commit. Tool-call runs that same commit **plus** runtime monkey-patches and three `.patch` files. One of those restores BFCL's force-quit semantics — without it, EvalScope's port lets a run that hit its per-turn step limit carry on with a fresh budget, which by their own measurement makes it **1.5–2.0× slower and measurably more lenient**.

So the moment we add BFCL, our number and their number will differ, and it won't be noise. That has to be settled before BFCL ships, not after: either we port the patch, or we write down that ours is a different (and arguably more correct) measurement and give it a different standard label.

### Adding a benchmark is not yet a one-file change

This one surprised me, and it matters for both goals.

The harness image bakes its datasets in at build time — a deliberate and correct choice, so a run can never die two hours in on a stalled download. The consequence is that the image tag *is* the dataset pin, and `framework_image` is a **hashed** field on a standard. Put those together and adding one benchmark means:

1. Write the standard YAML.
2. Add the dataset to the prefetch list.
3. Rebuild the image under a **new tag** (reusing the old tag would silently break the pin).
4. Update `framework_image` in **every existing standard** to the new tag.
5. Which mints a new hash, and therefore a new row, for **every standard we already have** — even though nothing about what they measure changed.

The IFEval file already documents one round of this happening (`2ce95c3` → `2ce95c3-tier1` when four datasets were added). It's honest and it's handled, but it doesn't scale to sixty standards across three frameworks, and it makes "adding a benchmark is routine" less true than the catalog doc assumes. Worth rethinking before the next batch — most likely by pinning datasets per standard rather than per image, so one benchmark's arrival stops rippling through every other benchmark's identity.

Related, and flagged in the build script's own comments: **the image has never been built from scratch and verified offline.** The instruction is to confirm `docker compose build harness` completes and then confirm a container run with `--network none` can still load every dataset. Until that's done, the dataset-pinning story is designed but unproven.

### Also worth knowing

Our serve job hardcodes tool-call's vLLM binary:

```
/home/shared/agentic_slm/qvac-research-tool-call/evaluation/venv/vllm/bin/vllm
```

That's pragmatic and it works. But it means the "independent" service currently depends on another team's install staying where it is, at the version it's at. If they rebuild their venv, our runs change underneath us with no hash moving. Worth either owning our own vLLM or recording its version as a hashed field.

### Rough distance to goal 1

The five benchmarks we have are the five easiest. Of the fifteen missing, roughly **four are near-trivial** (ceval, multi_if, plus aime25/math_500 once someone measures a context length), **one is medium** (bfcl_v3 — mostly the patch question), **nine are blocked behind one missing feature** (the auxiliary endpoint), and **one needs a security decision** (live_code_bench).

So "everything tool-call does" is not fifteen separate projects. It's **one feature, one patch decision, one measurement, and then a pile of YAML.** That's a much better position than the raw 5-of-20 number suggests — as long as the auxiliary-endpoint work is started now, because nine benchmarks sit behind it.

---

## 8. Goal 2 — taking benchmarks from other teams

Shorter, because the answer is simpler: **not yet, and the blocker is structural rather than incremental.**

Everything built so far assumes EvalScope. Not in a sloppy way — the abstraction boundaries are in the right places — but the seam where a second framework would plug in doesn't exist.

| Team | Framework | What's needed |
|---|---|---|
| **one-bit-models** | lm-eval 0.4.12 | A framework adapter and a second image. Genuinely the easiest of the three: lm-eval is a pip install with no cluster dependencies, and running it alongside EvalScope is the only way to settle the "two IFEvals" question with data instead of opinion. About 15 benchmarks, mostly uncontested. |
| **medpsy** | OpenCompass | An adapter, **plus** the auxiliary-endpoint work (their cascade extractor and rubric judges), **plus** a story for MEDEC's dataset, which isn't on any public hub and needs cached BERTScore and BLEURT models. About 18 standards. Their arena benchmark doesn't fit the schema at all — a Bradley-Terry rating is relative to a pool, not a standalone score, and needs its own storage. |
| **tether_VLMEvalKit** | VLMEvalKit | The biggest jump. Needs the harness to run **on the cluster** rather than on our server (gigabytes of images, heavy preprocessing), needs a judge, and needs metric-shape support the schema doesn't have. |

### Four concrete things to fix first

**1. Make `framework` actually dispatch.** Right now it's a label. It needs to select an image and a result parser. This is the single highest-leverage change for goal 2 — every other team's work sits behind it.

**2. Give metrics a shape.** `metric.value` is a bare float. The vision board breaks that assumption three separate ways: OmniDocBench reports an edit distance where **lower is better**, MME reports a **summed score** that isn't a fraction at all, and BabyVision is 0–100 but legitimately scores below 1.0 for small models — so the obvious "if it's ≤1.0 it must be a fraction, multiply by 100" rule produces garbage. Their `collect_board.py` has a comment saying exactly this. We need `unit` and `higher_is_better` on the metric row, not just in the standard's YAML.

**3. Decide where the harness runs.** Text benchmarks are CPU-bound and network-bound, so running them on our own server is a huge simplification and absolutely the right call. Vision isn't. The plan already names this (`where_it_runs`, defaulting to `service`) but the field doesn't exist and the code has no cluster-side execution path.

**4. Unpin datasets from the image tag.** The ripple described in Section 7 gets worse here, not better: three frameworks means three images, and under today's rule every dataset addition to any of them re-hashes a chunk of the catalog. Vision makes it worse again — baking gigabytes of images into a container is not the same proposition as baking five text datasets. This needs a different answer before the second framework lands, not after.

### And one thing that isn't code

We've now made ourselves the people who decide what "IFEval" means. That's the right call, but a team that disagrees with one of our choices has a legitimate grievance, and "the service said so" isn't an answer. The plan's proposal — a pull request to the catalog with one reviewer from the owning team — is sound and costs nothing. It just hasn't been agreed with anyone yet, and it needs to be before the sixth standard is written, not after the sixtieth.

---

## 9. Honest criticism

Things I'd push back on if I were reviewing this.

**The README undersells the work by a lot.** It says "the basic application structure only — no business logic yet" and "Phase 1... read-only APIs". There are 9,700 lines of backend implementing SSH, SLURM, endpoint lifecycle, harness execution, cancellation and a full run pipeline. Anyone reading the README to decide whether to look closer would conclude there's nothing here.

**The design documents outweigh the code.** 4,800 lines of docs against 9,700 lines of backend, with four *more* referenced documents that don't exist. The docs are excellent — genuinely among the better internal design writing I've read — but there's a point where the ratio says the planning is running ahead of the building. The catalog doc specifies 60-odd standards across seven tiers; five are implemented.

**The in-memory run registry contradicts the plan's own strongest recommendation.** The plan argues clearly and correctly for a reconciler, explains why a long-lived task per job is fragile, and the code then does the fragile thing. The comment acknowledges it ("No reconciler and no state machine, deliberately"), which is honest, but it's the kind of shortcut that gets much more expensive the longer it stays.

**Milestone 0 being skipped is a strategic mistake, not just a missing feature.** The plan's own argument for importing historical results first was that it tests the schema against real data, populates the UI on day one, can't break anything, and — most importantly — *gives the teams something before asking them for anything*. Skipping it means our adoption story is "come use our empty leaderboard."

**Five benchmarks from the same easy family is less validation than it looks.** IFEval, IFBench, GSM8K, GPQA-Diamond and MMLU-Pro are all rule-scored, single-turn, single-environment, no-judge benchmarks. They exercise one code path five times. The design hasn't yet met a judge, a user simulator, a second framework, a second image, a cluster-side harness, or a non-fractional metric — and each of those is where a schema usually finds out what it got wrong.

**Nothing has been checked against a team's real number yet.** The IFEval standard carries a reference score of `0.7412` from a real tool-call run, and a note saying the thinking-mode reference has never been run. So the parity check — the gate the plan says not to move past — either hasn't happened or isn't written down. Trust is the entire product here; one confirmed matching number is worth more than five more benchmarks.

**The vision prototype is a risk as well as an asset.** 5,500 lines of convincing mocked UI showing lineage graphs, confidence intervals and prediction diffs. It's clearly labelled, and it's clearly useful for getting buy-in. But it also sets an expectation that the real product is far closer to those features than it is, and the gap between the demo and the thing is now large enough to be awkward.

---

## 10. What I'd do next, in order

Ordered by "how much does this unblock", not by effort.

### Right now (days)

1. **Fix the README and restore the four missing docs** — or delete the 126 references to them. Right now the repo actively misleads a new reader in both directions.
2. **Build the legacy importer.** Read tool-call's existing `summary.json` tree into `eval_run` + `metric` rows, marked `legacy`, `is_standard = false`. It tests the schema against real data, fills the leaderboard, breaks nothing, and gives the teams something for free. It should have been first.
3. **Build the harness image from scratch and verify it works offline** (`--network none`, every dataset loads). It's the one build step the code itself flags as unproven, and everything downstream assumes it.
4. **Add `ceval`.** The cheapest new benchmark, and a useful forcing function — it's the run that shows how painful the image-rebuild ripple really is in practice.
5. **Run the IFEval parity check at full size and write the result down** — including which sampling profile produced the team's reference. Until that number matches, everything else is building on an unverified foundation.

### Next (weeks)

6. **Build the auxiliary endpoint table.** Nine tool-call benchmarks and every judged medical suite sit behind it. The catalog doc has already designed the schema and picked two proven endpoints to seed. This is the highest-value single piece of work in the repo.
7. **Add the reconciler and startup recovery.** Before anyone else depends on the service, a restart must not orphan GPUs and lie about run status.
8. **Add `stderr` to `metric`, and an error rate to `eval_run`.** Two columns, both cheap now and both requiring a backfill later.
9. **Settle the BFCL patch question, then ship `bfcl_v3`.** It's in three of tool-call's suites and it's the benchmark their team cares most about.
10. **Add suites.** A named group of standards. Small feature, disproportionate effect on whether anyone actually uses the submit page.

### Then (the goal-2 work)

11. **Make `framework` dispatch to an image and a parser.** The seam everything else needs.
12. **Unpin datasets from the image tag**, before there are three images and sixty standards to re-hash.
13. **Build the lm-eval adapter.** Easiest of the three, and it's the only way to answer "are the two IFEvals the same test?" with data.
14. **Add `unit` and `higher_is_better` to the metric row, and `where_it_runs` to the standard.** Both are prerequisites for vision, and both are cheaper to add before there's data to migrate.
15. **Agree the governance rule** — a PR to `catalog/` with one reviewer from the owning team. This costs nothing and is the thing most likely to sink the project if left unsaid.

### The things only a human can unblock

These have lead time and none of them are technical:

- **A non-interactive AWS identity.** SSO needs a browser; a service can't log in. Blocks everything S3.
- **Which judge, for each self-hosted one.** CompassJudger-2-32B, Gemma4_31B, medpsy's gpt-oss-20b and VLMEvalKit's FP8 vision judge have no third-party equivalent. Each needs either a substitute (and a parity check) or a scoped exception. That's a domain call, not a plumbing one.
- **Who signs off on a standard.** See point 15.
- **What the default think handling and token budget are.** The mechanism is built; the default is still a methodological choice, and it's what the leaderboard will show.

---

## In one paragraph

We've built a real evaluation service with a genuinely good design, and we've proved it works on the easiest five benchmarks in the building. The remaining distance to "everything the tool-call team does" is smaller than 5-of-20 makes it sound — it's essentially one missing feature (calling a second model), one patch decision (BFCL), and one measurement (long-context serving), after which most of the rest is YAML. The distance to "any team's benchmarks" is larger and more structural, and it starts with making the `framework` field actually mean something. The two most urgent things aren't on either list, though: import the teams' existing numbers so the leaderboard isn't empty, and make one of our numbers provably match one of theirs. Everything else is easier once those two are done.
