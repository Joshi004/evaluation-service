# Cutting v1 Down to Something We Can Actually Build

**Date:** Sep 2026
**About:** [`EVAL_SERVICE_PLAN.md`](./EVAL_SERVICE_PLAN.md) · [`DATA_MODEL.md`](./DATA_MODEL.md) · [`BENCHMARK_UNIFICATION_RESEARCH.md`](./BENCHMARK_UNIFICATION_RESEARCH.md)
**What this is:** you said the plan is doing too much at once and listed what you'd drop. I went through all of it, checked each item against the rest of the plan and the cluster findings, and looked for more. This is the answer plus a v1 schema.

Nothing here changes any code or any other doc.

---

## The short version

You were right about nearly all of it. I'd keep eight small things you wanted to drop, and I found a fair bit more to cut on top of your list.

| | Current plan | v1 |
|---|---|---|
| Tables | ~20 | **6** |
| Columns (rough) | ~285 | **~80** |
| Hashes | 2 (`recipe_hash`, `profile_hash`) | **1** |
| Redis | locks, caches, pub/sub, leases | **none** |
| Background machinery | reconciler loop + state machine | **one task per run** |
| UI pages | 9 | **5** |
| S3 | browse, register, stage, verify | **none** |

Nothing in the current schema is built yet — there are zero Alembic migrations and `models/base.py` is an empty `Base` class. So this isn't a rewrite, it's just deciding what to write first. That's a good position to be in.

---

## The one idea that does most of the work

Your immutable-recipe suggestion is the important one, and I think it should be the centre of v1 rather than one option among several. Here it is spelled out:

**A recipe row is created once from its own content and never changed.** You take everything that defines how a benchmark gets run — the dataset, the few-shot count, the prompt, the sampling numbers, max tokens, think handling — put it in one dictionary, hash it, and that hash is the recipe's identity. Before inserting you check whether a row with that hash already exists; if it does you reuse it. No row is ever updated or deleted.

A user override at submit time isn't a special case any more. It's just a different dictionary, which means a different hash, which means a different row:

```python
# the whole override mechanism
config = base_recipe.as_dict() | user_overrides   # e.g. {"max_tokens": 16384}
h = recipe_hash(config)                            # sha256 of canonical json, first 16 chars
recipe = get_by_hash(h) or insert(config, hash=h, label=None)
run = insert_eval_run(checkpoint_id=..., recipe_id=recipe.id)
```

Fifteen lines. Look at what that removes from `eval_run`:

- `sampling_source`, `think_source`, `max_tokens_source` — there is no "source" any more, there's just the recipe you ran
- `requested_overrides` — the override *is* the recipe
- `resolved_profile` — the recipe is already fully resolved by construction
- `profile_hash` — the recipe hash is the only hash
- `sampling_profile_name` — no profile table to name
- `is_standard` — see below
- `thinking_mode` — if think-on and think-off are two recipes (your point 4), this is redundant

And from `recipe`:

- `status` (draft/active/retired) and the one-active-recipe index — nothing needs a single blessed version if any result can be compared with any other
- `source_yaml_sha256` — the recipe hash *is* the idempotency check. Loading the same YAML twice finds the same hash and does nothing. That's for free.
- `standard_profile_hash`, `verified_against_run_id`, `effective_from`

It also gives you exactly the UI behaviour you asked for. "Colour the rows by recipe hash" is `GROUP BY recipe_id` and assign a colour per group. Two rows with the same colour were produced the same way; different colours mean look before you compare. No asterisks, no publish gate, no standard/exploratory split.

**One nice side effect.** Give `recipe` a nullable `label`. Recipes loaded from the reviewed YAML in `standards/` get one (`ifeval/v1`); recipes minted from a user override get `NULL`. That single nullable column recovers the whole "is this a reviewed standard or somebody's experiment" question that `is_standard` and `status = 'active'` were for, and the Standards page is `WHERE label IS NOT NULL`.

**The honest cost.** Recipe rows multiply — every override mints one. They're a few hundred bytes each and deduplicated by hash, so a few thousand rows is nothing. The other cost is that fixing a typo in a recipe means inserting a new row rather than editing, and old runs keep pointing at the typo. That's the intended behaviour, but it will feel strange the first time.

I'd keep the hash rule from the data model doc as-is, because it's free and getting it wrong is subtle: canonical JSON (keys sorted, no whitespace, UTF-8), **floats rounded to 6 decimal places before serialising**, SHA-256, first 16 hex characters. Without the rounding, `0.1 + 0.2` and `0.3` hash differently and you find out months later.

---

## Your list, item by item

### Agreed, drop it

| You said | My take |
|---|---|
| One cluster only | Agreed, and I'd go further — see below |
| Drop `verified` everywhere | Agreed. With one or two benchmarks you know by hand whether parity passed. Do the parity check as a manual gate before trusting any number; it doesn't need a column. |
| `default_sampling` as real columns, not JSONB | Agreed, strongly. Sampling is seven known fields with fixed types — that's exactly what columns are for. The data model doc's own rule says "JSONB for shapeless things, columns for everything else" and then puts sampling in JSONB, which I think is a slip. |
| Drop `sampling_profile` table | Agreed. The doc itself says it's "a vocabulary, not a runtime dependency" read in exactly two places. With 1–2 recipes, YAML defaults do the same job. Seed the seven numbers straight into the recipe columns. |
| No think/no-think column on recipe | Agreed. Two recipes, two hashes, two colours. Falls out of immutability for free. |
| Any result comparable with any other; colour by hash | Agreed. This is what kills `publication`, `is_standard`, `status`, and the standard/exploratory split all at once. |
| Drop `standard_profile_hash`, `source_yaml_sha256`, `source_note`, `changelog`, `verified_against_run_id`, `effective_from` | Agreed on all six. `changelog` and `source_note` belong in the YAML comments and the git history, which is where people will actually read them. |
| Drop `model.owner_team` | Agreed — and I'd drop the whole `model` table, see below |
| No S3, no sync, checkpoints pre-exist on the cluster | Agreed. Biggest single scope cut available and it removes more than you listed. |
| Drop `checkpoint.source`, `s3_bucket`, `s3_prefix`, `hf_repo_id`, `lineage_op`, `lineage_params`, `training_run_url` | Agreed. Also drop `inventory`, `object_count` and `total_bytes` — all three existed only to verify a sync that no longer happens. |
| Drop `s3_listing_cache` | Agreed. |
| Store the whole recipe on the run instead of `recipe_id` | Your second idea (immutable rows) is better than your first (JSONB blob) and I'd take it. A JSONB copy on every run still needs a hash to group by, so you end up storing both a blob and a hash on thousands of rows, and you lose the ability to list what recipes exist. Immutable rows give you the same guarantee with a plain integer FK. |
| Simplify `endpoint` hard | Agreed, with two changes — see below |
| One URL instead of node + port + base_url | Agreed. |
| Drop `endpoint.gpus`, `node_observed_at`, `ready_at`, `last_used_at`, `failure_kind` | Agreed. |
| Drop `eval_run.sampling_source`, `think_source`, `max_tokens_source`, `sampling_profile_name` | Agreed. |
| Drop `result_status` | Agreed — fold into one `status` column. |
| Drop `cancel_requested_at` | Agreed. The API can call `scancel` directly and set the status. That column existed to stop the API and the reconciler both writing cluster state, and there's no reconciler now. Cancel becomes a synchronous call that may block for a few seconds, which is fine. |
| Drop `orphan_job_sighting` and the orphaned-job concept | Agreed, with one guardrail replacing it — see below |
| Drop `audit_event` | Agreed. `submitted_by` plus `created_at` on the run covers most of it, and the app log covers the rest. |
| No Redis | Agreed, all of it. Locks, caches, log ring buffer, pub/sub, leases — none of it is needed once there's no reconciler and no live streaming. Redis can come out of `docker-compose.yml` too. |
| Sync API calls, fresh queries, accept the latency | Agreed, with one warning: `sacct` was measured at **47 seconds** and `scontrol show job` at **27**. Any page that makes a live SSH call needs a hard timeout and an error message, or a browser tab will just hang. |

### Agreed, but here's the tweak

**One cluster: I'd drop the table, not just the rows.** You said keep the table and assume one row. But with one cluster, every `cluster_id` column is a constant — that's five columns of noise plus five joins that never branch. And the contents (`ssh_host`, `ssh_user`, `model_root`, `log_root`, `default_partition`, `default_walltime_s`) are deployment config that sits next to the SSH key, not data a user should be able to edit in a UI. Put them in `app/config.py`, which already exists and already uses pydantic-settings.

If you'd rather keep the table for the Cluster page, that's fine — but keep it as a single row with **no `cluster_id` foreign keys anywhere else**. A table nothing points at is cheap; a constant FK on five tables is not. Adding it properly later is one small migration.

**`endpoint` needs `checkpoint_id`.** Your column list was `id, cluster_id, serving_profile_id`. Without the checkpoint you can't answer "is there already a server running these weights?", and that question is the entire reason endpoints are a separate table — a cold start was measured at **350 seconds of H100 time**. The reuse key is `(checkpoint_id, serving_profile_id)`.

**Drop `endpoint.state`, but add `expires_at`.** Your reasoning is right — a six-value state machine plus a poller to keep it honest is real complexity. But "assume it's available forever" breaks in a specific way: every serve job carries an explicit `--time`, so the server *will* die on schedule, and a run submitted next week would attach to a dead URL and fail with a confusing connection reset. That exact failure already cost an afternoon during cluster validation.

The fix is one timestamp instead of an enum. Write `expires_at = now() + walltime` when you submit the serve job, and the reuse rule is `WHERE checkpoint_id = ? AND expires_at > now()`. No state machine, no poller, nothing to keep in sync — the row ages out on its own. If a server dies early you get a clear error on the run, which is acceptable for a POC.

**Drop `status`? This is the one I'd genuinely resist.** I think two different things got merged here. You said status shouldn't be stored because we're not doing live streaming, and you're right that we shouldn't be *polling the cluster* to keep a status column fresh. But the run's own lifecycle state has to be persisted for two reasons that have nothing to do with streaming:

1. Something has to answer "which runs aren't finished?" Without a status column that query doesn't exist, and whatever code is driving runs forward has nothing to look at.
2. A run's outcome outlives SLURM's memory of it. `sacct` retention is finite; the run row is forever. If we don't write down that a run failed, we can't ever say so again.

So my suggestion is to keep **one** `status` column and drop the other two around it. Right now the plan has `status` (5 values) plus `phase` (6 values) plus `result_status` (3 values) — three columns and fourteen states describing one thing. Collapse all of that into:

```
status: queued | running | done | failed | cancelled
```

One column, five values. That's a real simplification and it keeps the one thing you can't work without.

**Diagnostics: keep two of the six.** You said drop them all. I'd drop `error_rate`, `prompt_count`, `gpu_seconds` and `error_kind` without hesitation, and keep these two:

- **`truncation_rate`** (one nullable float). This isn't hypothetical. The Milestone 1 checkpoint — `Qwen3-4B-allternary-ep03`, the exact model the first real run uses — hit `finish_reason: "length"` on **12 of 12** requests in a trivial test, spending its whole budget inside a `<think>` block and never answering. If v1's first number comes out of a run like that, the number measures our token budget and nothing else, and we won't know. It's a one-line count over the predictions the harness already wrote.
- **`error`** (one nullable text). When a run fails, "read the SLURM log over a 47-second SSH call" is not a debugging story. Store the message.

### One more thing to drop that you didn't list

`requested_overrides` on `eval_run`. You kept it — "we are already keeping requested override JSONB" — but under immutable recipes the override became the recipe, so the column would just duplicate a diff of two rows you already have. If you want to show "this run overrode the standard recipe", that's `run.recipe.label IS NULL` plus a field-by-field diff against the base recipe, computed on the fly.

---

## Extra cuts, beyond your list

These are the ones I'd add. The first two are the biggest and neither is on your list.

### Drop the `job` table entirely

This one surprised me. Walk through what SLURM jobs v1 actually has:

- **Staging jobs** — gone, no S3.
- **Cluster-side eval jobs** — don't exist. Section 9 of the plan is emphatic that text benchmarks run the harness *on our own server* against an HTTP endpoint, because EvalScope with `eval_type: openai_api` never loads the model. Vision benchmarks are the ones that need the cluster, and they're wave 6.
- **Serve jobs** — the only kind left, and there is exactly one per endpoint.

So `job` becomes a 22-column table with a three-way owner constraint that holds one row per endpoint. Put `slurm_job_id` on `endpoint` and delete the table.

What you lose: no stored record of failed serve attempts, and no `raw_state` / `exit_code` / `script` / `stdout_path`. For a POC that's `sacct -j <id>` by hand, and the log path can follow a naming convention (`{log_root}/evalsvc-{endpoint_id}-{slurm_job_id}.out`) rather than being stored. Bring `job` back when the second job kind appears, which is exactly when vision benchmarks arrive.

### Drop `artifact_location`

Its whole job is answering "are these weights staged on this cluster, verified, and safe to serve?" With no S3 and one cluster the answer is always "yes, at `checkpoint.path`". That's a table, a five-value state enum, a lock, a job kind, and a verification step replaced by one text column that's already there.

### Four more tables that collapse into columns

| Drop | Becomes | Why it's safe |
|---|---|---|
| `model` | `checkpoint.family` (nullable text) | Its only real job is grouping checkpoints in the UI, and `GROUP BY family` does that. `modality` isn't needed (v1 is text-only) and `architecture` isn't needed (the serving profile is picked explicitly). Keep it if you want a Models page soon — otherwise it's a required FK on every registration that buys nothing. |
| `framework` | `recipe.framework` + `recipe.framework_image` | v1 has one framework. Putting the name and image on the recipe also means they feed the hash automatically, which is what you want — a harness rebuild should change the hash. `result_parser` isn't needed either; the framework name selects the parser in code. |
| `recipe_metric` | `recipe.metrics` (JSONB array) | It's a list, so it was always going to be a child table or JSONB — never columns. With 1–2 benchmarks and ~4 metrics each, and a recipe row that can't change underneath it, JSONB is simpler. Shape: `[{name, display_name, higher_is_better, is_primary, harness_key}]`. Add the table back when you have twenty benchmarks and want to query across metric definitions. |
| `run_artifact` | `eval_run.output_dir` (text) | The harness writes everything into one directory per run. `predictions.jsonl`, `summary.json` and the log are known filenames inside it. One column beats a table with a `kind` enum, a URI scheme, a sha256 and a retention policy. |

`benchmark` is the debatable one. Strip everything v1 doesn't use — `framework_id` (moves to recipe), `modality` (text only), `where_it_runs` (always our server), `family` (no composites), `typical_gpu_hours` (no dry-run estimate), `needs_judge` (no judges), `verified` (dropped), `task_name` and `question_count` (both belong to the recipe) — and you're left with `name` and `display_name`. A two-column table with two rows. I'd make it `recipe.benchmark` as a text slug and get the leaderboard's column list from `SELECT DISTINCT benchmark FROM recipe`. Keep the table if you want somewhere to hang per-benchmark descriptions for a methodology page.

### Two more tables that just aren't v1

- **`publication`** — the deliberate act of putting a number on the board, with a supersede chain. Your "any result is comparable, colour by hash" decision replaces it. The leaderboard shows the latest run per (checkpoint, recipe) and colours by recipe. Add this back when numbers start leaving the building.
- **`run_group`** — for sweeps: submit fifteen cells, get one progress bar and one cancel button. v1 submits one run at a time. Add it when you add sweeps.

### Shrink `serving_profile` from 13 columns to 6

`chat_template`, `tool_parser`, `reasoning_parser`, `reasoning_history`, `tensor_parallel` and `gpu_mem_util` are all literally vLLM command-line flags — `--tool-call-parser hermes`, `--tensor-parallel-size 2`, `--gpu-memory-utilization 0.85`. There's already a `vllm_flags text[]` column that carries arbitrary flags one token per element. Fold them in.

Two stay as real columns because they're needed outside the flag list: `gpus` (goes in the sbatch `--gres` line) and `max_model_len` (so submit can check that the recipe's `max_tokens` plus the prompt actually fits, which catches a class of failure that otherwise shows up six minutes later as a confusing runtime error).

I'd keep this as a table rather than folding it into `checkpoint`, because it's the endpoint reuse key and copying a flag list per checkpoint is how flag lists drift apart.

### Runtime: no reconciler in v1

This is the biggest code cut and it isn't a schema question at all.

The plan's reconciler is a 20-second loop that reads all unfinished work, makes one bulk `squeue` call, writes down what it heard, and advances every run one step. It's genuinely well designed — idempotent, holds no state, survives restarts. It's also a state machine plus an admission controller plus a leader election plus a phase-transition table, and it exists mainly to solve problems that show up under concurrency and deploys.

For v1 I'd run **one background task per run**, doing the steps in a straight line:

```
reuse or start endpoint  →  poll /v1/models until ready  →  run harness container
                         →  parse output  →  write metrics  →  status = done
```

That reads like the sequence diagram, has no state machine, and needs no idempotency because nothing else is touching the row. Maybe 100 lines instead of 400.

What you give up: if the backend restarts mid-run, that run is stuck in `running` forever. Two cheap mitigations, both worth having:

1. On startup, `UPDATE eval_run SET status = 'failed', error = 'backend restarted' WHERE status = 'running'`. One line. You resubmit.
2. Every serve job carries an explicit `--time`, so an abandoned server dies on its own.

This is reversible. Swapping in a reconciler later is a rewrite of one module plus an additive migration, as long as `status` and `endpoint.slurm_job_id` exist — which they do.

### The one guardrail I would not skip

Dropping the endpoint state machine, the orphan detection and `max_concurrent_gpus` together leaves v1 with no automatic brake on a shared 1200-GPU cluster that three other teams are also using. Two things cost nothing and I'd treat both as non-negotiable:

- **An explicit `--time` on every single job.** `main` has `MaxTime=UNLIMITED` and `DefaultTime=NONE`, so the cluster will never impose one for us. This is the only thing standing between a forgotten vLLM server and eight idle H100s over a weekend. It bounds the damage by construction.
- **A hard cap on live endpoints in config.** `MAX_LIVE_ENDPOINTS=2`, checked with `SELECT count(*) FROM endpoint WHERE expires_at > now()` before submitting. One query, no table, no orphan tracking, and it makes a runaway loop impossible.

---

## On naming: `checkpoint`, not `artifact`

You asked whether the table should be `artifact` or `checkpoint`, and whether there'll be other artifact types.

**Call it `checkpoint`.** Three reasons. It's the word the team already says out loud. "Artifact" is ambiguous here precisely *because* the plan also has `run_artifact` for the files a run produces — two unrelated things fighting over one word. And a generic name invites a `type` column, which invites nullable columns per type, which is how a clean table becomes a polymorphic mess.

Are other artifact types coming? I don't think so, and it's worth checking the candidates:

- **LoRA adapters** and **quantized variants** are checkpoints. They're a set of weights you can point vLLM at. They fit the table as-is, with a note in `quantization` if you want one.
- **Tokenizers and chat templates** ship inside the checkpoint directory. They're files, not rows.
- **Benchmark datasets** are deliberately not ours — Section 8 of the plan is clear that the harness owns them, and that's the right call.
- **Judge models** are just checkpoints too, when they arrive.

So the only genuinely different thing is run output, and that's now one `output_dir` column. No `artifact` table, no `type` column.

---

## The v1 schema

Six tables. Every column here has a reason; anything I couldn't justify for the first real number is gone.

```sql
-- 1. weights we can evaluate. always already on the cluster in v1.
CREATE TABLE checkpoint (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                 text NOT NULL UNIQUE,      -- 'Qwen3-4B-allternary-ep03'
    path                 text NOT NULL,             -- '/home/shared/agentic_slm/models/...'
    family               text,                      -- 'Qwen3-4B', for grouping in the UI
    parent_checkpoint_id bigint REFERENCES checkpoint(id),
    serving_profile_id   bigint NOT NULL REFERENCES serving_profile(id),
    generation_config    jsonb,                     -- the checkpoint's own sampling defaults
    registered_by        text,
    created_at           timestamptz NOT NULL DEFAULT now()
);

-- 2. how to launch vllm for this family of weights. also the endpoint reuse key.
CREATE TABLE serving_profile (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           text NOT NULL UNIQUE,            -- 'qwen3'
    vllm_flags     text[] NOT NULL DEFAULT '{}',    -- one argv token per element
    gpus           smallint NOT NULL DEFAULT 1,
    max_model_len  integer,
    engine_version text NOT NULL,                   -- '0.19.0'
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. everything that defines how a benchmark is run. immutable, content-addressed.
CREATE TABLE recipe (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hash              char(16) NOT NULL UNIQUE,     -- identity. computed from the content.
    label             text,                         -- 'ifeval/v1'; NULL = ad-hoc override
    benchmark         text NOT NULL,                -- 'ifeval'
    framework         text NOT NULL,                -- 'evalscope' -- also picks the parser
    framework_image   text NOT NULL,                -- pinned image ref or digest
    task_name         text NOT NULL,                -- what the harness calls it
    dataset_name      text NOT NULL,
    dataset_revision  text NOT NULL,                -- pinned, not merely recorded
    split             text,
    few_shot          smallint NOT NULL DEFAULT 0,
    prompt_template   text NOT NULL DEFAULT '',
    extraction        jsonb NOT NULL,               -- genuinely shapeless per benchmark
    metrics           jsonb NOT NULL,               -- [{name, display_name,
                                                    --   higher_is_better, is_primary,
                                                    --   harness_key}]
    repeats           smallint NOT NULL DEFAULT 1,
    sample_limit      integer,                      -- harness --limit; NULL = full run
    -- sampling, as real columns. every one NOT NULL on purpose:
    -- anything we leave unset is a value the checkpoint fills in for us, invisibly.
    temperature        double precision NOT NULL,
    top_p              double precision NOT NULL,
    top_k              integer NOT NULL,
    min_p              double precision NOT NULL DEFAULT 0.0,
    presence_penalty   double precision NOT NULL DEFAULT 0.0,
    repetition_penalty double precision NOT NULL DEFAULT 1.0,
    max_tokens         integer NOT NULL,
    enable_thinking    boolean NOT NULL,            -- think vs no-think = two recipes
    think_handling     text NOT NULL
                            CHECK (think_handling IN ('strip','as_is')),
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- 4. a running vllm server. one slurm serve job per row; no separate job table.
CREATE TABLE endpoint (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checkpoint_id      bigint NOT NULL REFERENCES checkpoint(id),
    serving_profile_id bigint NOT NULL REFERENCES serving_profile(id),
    url                text,                        -- one reachable URL, not node+port
    slurm_job_id       integer,
    expires_at         timestamptz NOT NULL,        -- submitted_at + walltime
    created_at         timestamptz NOT NULL DEFAULT now()
);

-- 5. one attempt to evaluate one checkpoint under one recipe.
CREATE TABLE eval_run (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checkpoint_id   bigint NOT NULL REFERENCES checkpoint(id),
    recipe_id       bigint NOT NULL REFERENCES recipe(id),
    endpoint_id     bigint REFERENCES endpoint(id),
    status          text NOT NULL
                         CHECK (status IN ('queued','running','done','failed','cancelled')),
    output_dir      text,                           -- harness wrote everything here
    results_json    jsonb,                          -- the harness summary, verbatim
    truncation_rate double precision,               -- 12/12 on the milestone 1 checkpoint
    error           text,
    submitted_by    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    started_at      timestamptz,
    finished_at     timestamptz
);

-- 6. one row per number a run produced. rows, not columns, so a new
--    benchmark never needs a migration.
CREATE TABLE metric (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    eval_run_id bigint NOT NULL REFERENCES eval_run(id) ON DELETE CASCADE,
    name        text NOT NULL,                      -- 'prompt_level_strict'
    value       double precision NOT NULL,          -- normalized: fractions are 0..1
    n_samples   integer,                            -- 541 for a full IFEval run
    is_primary  boolean NOT NULL DEFAULT false,
    UNIQUE (eval_run_id, name)
);

CREATE INDEX eval_run_board ON eval_run (checkpoint_id, recipe_id, finished_at DESC)
    WHERE status = 'done';
CREATE INDEX endpoint_reuse ON endpoint (checkpoint_id, serving_profile_id, expires_at);
```

One index each for the two queries that run constantly — the leaderboard and endpoint reuse. Everything else can table-scan at these row counts.

### On results storage

You suggested storing run artifacts as JSONB and building leaderboards from that dynamically. I'd split the difference, because the word "artifact" is covering two very different things:

- **The harness summary** is a few KB of numbers. Store it verbatim in `eval_run.results_json`. This is your idea and it's a good one — it's the receipt that proves what the harness actually said, so when the parser turns out to be wrong you can re-parse without re-running.
- **The predictions** are not small. A thinking model emitting 16k tokens of reasoning is roughly 60 KB per prompt, so one 541-prompt IFEval run is around **32 MB**. Those stay on disk under `output_dir` with no pointer table.

But I'd still keep the `metric` table rather than driving the leaderboard off JSONB, for one reason: every benchmark's summary has a different internal shape, so a JSONB-only board needs per-benchmark extraction logic inside the query. Six `metric` columns mean the leaderboard is one stable SQL query that never changes when you add a benchmark. That's the whole point of metrics-as-rows and it's worth the small table.

Two columns I'd *not* store: `stderr` and `stderr_source`. The error bar is `sqrt(p*(1-p)/n)` from `value` and `n_samples`, both of which are already there. Compute it at render time — one line, two fewer columns. (EvalScope does report the sample count as `num` per metric, so `n_samples` is available for everything in v1.)

### The one column I'd argue to keep against your list

`checkpoint.parent_checkpoint_id`. You didn't ask to drop it — you listed `lineage_op`, `lineage_params` and `training_run_url`, and I agree those three go. But it's worth saying why the parent link should survive even though there's no lineage graph in v1: it's the only field here you genuinely cannot backfill. Six months from now nobody will remember which checkpoint `-allternary-ep03` was quantized from. One nullable self-reference costs nothing today and the plan calls the lineage graph the feature people would actually open the tool for.

---

## Everything else that gets simpler

**UI: nine pages to five.** Leaderboard, Submit, Runs (list plus detail), Checkpoints, Endpoints. Dropped: S3 Browser (no S3), Compare (v2), Cluster (fold a health dot into the header), Standards (or make it a plain table of `recipe WHERE label IS NOT NULL`, which is nearly free since the rows already exist).

**API: eight routers to six.** The scaffold already has stubs for health, checkpoints, benchmarks, runs, leaderboard, endpoints, cluster and standards. With `benchmark` and `cluster` gone as tables, that's health, checkpoints, recipes, runs, leaderboard, endpoints.

**Keep the YAML in `standards/`.** It's already bind-mounted read-only into the backend at `/standards`, review-in-a-pull-request is the entire governance story, and content-addressing makes the loader idempotent for free — load the file, build the dict, hash it, insert if the hash is new. About thirty lines.

**Keep Alembic from the first migration.** No reason to change that.

**Drop Redis from `docker-compose.yml`.** Three containers instead of four.

---

## What we're giving up, and how to get it back

Worth being straight about this so nobody's surprised later. None of it is a one-way door.

| Given up | Costs us | Getting it back |
|---|---|---|
| Reconciler | A backend restart kills in-flight runs | Rewrite one module; additive migration |
| `job` table | No record of failed serve attempts | Add the table when cluster-side (vision) benchmarks arrive — that's when a second job kind exists |
| S3 + staging | Checkpoints must be put on the cluster by hand | Add `artifact_location` back plus the sync job. Also unblocks the AWS non-interactive credential question, which has lead time — worth asking now even though v1 doesn't need it. |
| `publication` | No "official number" concept | One table plus a publish button |
| Re-scoring (`inference_source_run_id`) | A scoring fix means re-running on GPUs | Add one column later — **but keep the predictions from day one.** A prediction we deleted is a re-score we can't do, and that's the one thing on this list you genuinely cannot recover. No retention policy in v1: keep everything. |
| `audit_event` | No durable who-did-what beyond `submitted_by` | One append-only table, written from the controller layer |
| GPU admission control | A runaway loop could take real GPUs | The `--time` rule and the config cap cover the realistic cases |
| Error bars stored | Nothing — they're derived | Already have `value` and `n_samples` |

---

## Build order

Two steps instead of four milestones.

**Step 1 — the schema and an empty board.** The six tables above, one Alembic migration, the YAML loader, `standards/ifeval.yaml` with every field sourced, and a leaderboard page that correctly renders nothing. No cluster contact. Seed one `serving_profile` (`qwen3`) and register `/home/shared/agentic_slm/models/Qwen3-4B-allternary-ep03` as a checkpoint.

**Step 2 — one real number.** The SSH connector behind the six-method interface, the serve job template (explicit `--time`, `--generation-config vllm`, `kill -0` liveness check inside the readiness loop, port from `8000 + (job_id % 250) * 8`), the EvalScope container, the per-run background task, the result parser, and the run detail page. Then run IFEval at full size and compare against the team's number.

Three things carry over from the validation work and are worth restating because they're cheap and each one has already cost someone real time:

- **Expect a six-minute cold start.** 350 seconds measured for a 4B model — about 128s of Python imports off the NFS, 80s to read the 8 GB shard, 72s of engine init. The 900-second readiness timeout is right.
- **Check `kill -0` on the vLLM process inside the readiness loop.** A bad flag killed the server in seconds and the readiness poll then held an H100 for 10 minutes 46 seconds polling a dead process.
- **Never trust a cached node name.** Even with one URL column, re-read it from `squeue` if a connection fails rather than assuming the server is dead — a stale hostname and a dead server look identical.

And the one open question that v1 can't dodge, because it decides what `recipe.think_handling` and `max_tokens` get seeded with: **what is our default think handling, and what is the token budget?** The recommendation in the plan is `strip`, on the evidence that this checkpoint returns no answer at all otherwise. Under immutable recipes this is less scary than it was — a different answer is just a different recipe row and a different colour — but somebody still has to pick what goes in `ifeval/v1`.

---

*Everything about the cluster quoted here — the 350-second cold start, the 47-second `sacct`, the 12-of-12 truncation, the 8 GB shard at ~100 MB/s, `MaxTime=UNLIMITED` — is measured and comes from [`CLUSTER_VALIDATION.md`](./CLUSTER_VALIDATION.md). Table and column shapes are the ones in Section 5 of [`DATA_MODEL.md`](./DATA_MODEL.md), reduced. The claim that EvalScope reports a per-metric sample count comes from the real `summary.json` quoted in that doc's Section 7. Row-count arithmetic is arithmetic on assumptions, not measurement.*
