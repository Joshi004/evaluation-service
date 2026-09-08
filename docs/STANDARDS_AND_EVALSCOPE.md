# Standards, IFEval, and EvalScope

**Date:** Sep 2026
**Status:** Reference for v1. Written by reading EvalScope's own installed source (`evalscope==1.11.1` off PyPI) and, more usefully, the actual `qvac-research-tool-call` checkout on this machine — its real config, its real patches, and a real completed IFEval run (`slurm_job_id=270187`) against `Qwen3-4B-allternary-ep03`, the same checkpoint the rest of this project's docs use. Every concrete number or field name below is one of those two things, not a guess. Where I couldn't verify something, it says so.
**Companion to:** [`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) (the `recipe` table this YAML fills in) · [`EVAL_SERVICE_PLAN.md`](./EVAL_SERVICE_PLAN.md) Section 5 (why the standard/profile split exists) · [`V1_SIMPLIFICATION.md`](./V1_SIMPLIFICATION.md)

This answers three things: how `standards/ifeval.yaml` should actually look, how a YAML file in that folder turns into a leaderboard number, and enough about EvalScope itself that someone setting this up on a different box from scratch isn't guessing.

---

## 1. The mental model, in one pass

Four things, in order:

1. **A YAML file under `standards/`** is a benchmark's protocol and sampling, written down and reviewed like code.
2. **A loader reads it, hashes it, and inserts one row into `recipe`** ([`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) Section 3.3) — immutable from that point on.
3. **A worker turns that row into an EvalScope `TaskConfig`** and points it at a vLLM endpoint over the SSH tunnel.
4. **EvalScope makes plain HTTP calls** — it never loads the model itself — scores the replies, and writes a report our worker parses into `eval_run.results_json` and `metric` rows.

Nothing here is new machinery. It's the same run-flow diagram in [`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) Section 5, one level more concrete at the one step that plan leaves unspecified: what actually goes in the YAML, and what actually happens when EvalScope runs.

---

## 2. EvalScope itself

### What it is and why the request shape matters

[EvalScope](https://github.com/modelscope/evalscope) is ModelScope's evaluation harness. The one fact that makes v1 possible, already decided in [`EVAL_SERVICE_PLAN.md`](./EVAL_SERVICE_PLAN.md) Section 9: run it with **`eval_type='openai_api'`** and it never loads a model at all — it makes plain HTTP calls to an OpenAI-compatible endpoint. For every text benchmark we care about first, that means EvalScope is **CPU-only and network-bound**, so it runs in a container on our own server, pointed at the SSH tunnel to vLLM. It never touches the cluster's filesystem, never needs a GPU, and can be developed against a local vLLM instance with no cluster access at all.

### Pinning it

The plan already names the pin: `2ce95c3` in `docker-compose.yml`'s env and [`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) Section 7's `HARNESS_IMAGE`. The full commit, confirmed from `qvac-research-tool-call/evaluation/setup.sh`, which builds EvalScope from source rather than from PyPI:

```
EVALSCOPE_REPO=https://github.com/modelscope/evalscope.git
EVALSCOPE_REV=2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85
```

Build from that commit, not from the PyPI release (`1.11.1` as of this writing) — a from-source build is what lets `evalscope-ext`/adapter patches apply at all, and it's what the one working reference for this stack actually runs, so it's the version every fact below was checked against or is closest to. Everything in this doc that reads the installed package (Section 5's `min_p` finding) was checked against PyPI `1.11.1` rather than this exact commit, because I don't have cluster access to that source tree from here — flagged again where it matters.

### Installing IFEval's extras

EvalScope ships a real, named extras group for this — confirmed from the wheel's own package metadata, not inferred:

```bash
pip install "evalscope[ifeval]"   # pulls in langdetect and nltk>=3.9
```

`nltk` being installed doesn't fetch its corpora. IFEval's constraint checkers call `nltk.download()` lazily the first time they run, which means the first real request in a job would hit the network — or fail, if the container has none. Bake the download into the image instead:

```python
import nltk
for package in ("punkt", "punkt_tab", "stopwords", "averaged_perceptron_tagger_eng", "cmudict"):
    nltk.download(package, download_dir="/opt/nltk_data", quiet=True)
```

That exact package list is copied from `qvac-research-tool-call/evaluation/setup.sh`, which downloads them for this reason and no other. `NLTK_DATA=/opt/nltk_data` then needs to be set in the container's environment so nltk finds them without touching the network. Skipping this is a real, observed failure mode, not a hypothetical — see the FAQ entry about `punkt_tab` in EvalScope's own docs.

### Calling it

Two ways in, both real. The CLI is what you'd use to smoke-test the setup by hand:

```bash
evalscope eval \
  --model Qwen3-4B-allternary-ep03 \
  --api-url http://127.0.0.1:19001/v1 \
  --api-key EMPTY \
  --datasets ifeval \
  --limit 10   # drop this for a real run
```

Our worker uses the Python API instead, since it's already Python and this avoids shelling out and re-parsing stdout:

```python
from evalscope import TaskConfig, run_task

run_task(task_cfg=TaskConfig(
    model="Qwen3-4B-allternary-ep03",
    api_url="http://127.0.0.1:19001/v1",
    api_key="EMPTY",
    eval_type="openai_api",
    datasets=["ifeval"],
    limit=10,
))
```

Section 4 below builds the real version of this — from a `recipe` row rather than hardcoded — field by field.

### What it writes to disk

This corrects something I said earlier in this chat: I described `output_dir` as holding flat files (`predictions.jsonl`, `summary.json`, `harness.log`). That was wrong — I hadn't yet read EvalScope's actual layout. The real tree, confirmed both from EvalScope's own docs and from a real run directory on disk in `qvac-research-tool-call`:

```
<output_dir>/
├── configs/
│   └── task_config.yaml               # the fully-resolved TaskConfig, dumped verbatim
├── logs/
│   └── eval_log.log
├── predictions/
│   └── Qwen3-4B-allternary-ep03/
│       └── ifeval_default.jsonl       # one line per prompt: full completion, usage, latency
├── reports/
│   └── Qwen3-4B-allternary-ep03/
│       └── ifeval.json                # the parsed report -- this is what results_json should be
└── reviews/
    └── Qwen3-4B-allternary-ep03/
        └── ifeval_default.jsonl       # per-sample pass/fail against each constraint
```

Nested by model tag and dataset name, not flat — because a `work_dir` can in principle hold more than one model or dataset. For us it never does (one checkpoint, one benchmark, one `eval_run`), so the nesting is just a fixed two extra path segments, not a real complication. The `_default` suffix on the predictions and reviews filenames (but not the report) is the subset name (`default`, IFEval's only one) — real, not a typo; confirmed on disk from an actual run, and worth knowing so a filename-matching script doesn't quietly find nothing. Point `eval_run.output_dir` at the EvalScope `work_dir` root directly; don't copy files out of it. The two files that matter:

- **`reports/<model_tag>/<dataset>.json`** → parsed into `eval_run.results_json` (store verbatim) and the `metric` rows (see Section 5.5 for the exact keys).
- **`predictions/<model_tag>/<dataset>_<subset>.jsonl`** → left exactly where it is. This is the ~32 MB-per-run file [`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) Section 3.6 says to never delete.

`reviews/` is worth keeping for debugging (it says *which* constraint a prompt failed, not just the aggregate score) but nothing in the schema reads it. `configs/task_config.yaml` is a useful sanity check during development — it's the fully-resolved config, so it's how you'd confirm EvalScope actually received what the recipe row says it should have.

---

## 3. Writing a standard: `standards/ifeval-*.yaml`

### One file per recipe row, not one file per benchmark

[`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) already decided that thinking and non-thinking are two different recipes, not a column (Section 3.3, and your own call in this chat: *"think/no_think... treat them as two different recipes"*). That decision has a consequence for the YAML layer nobody has written down yet: **since a `recipe` row is flat and immutable, the natural mapping is one YAML file per row**, not one file with a "variants" list the loader has to branch on. Filename convention proposed here (not fixed anywhere else, so treat it as a recommendation): `standards/<label with / replaced by ->.yaml`. So:

- `standards/ifeval-v1-instruct.yaml` → `label = 'ifeval/v1-instruct'`
- `standards/ifeval-v1-think.yaml` → `label = 'ifeval/v1-think'`

Yes, this duplicates the Layer-1 fields (dataset, prompt template, metrics) across both files. That's the honest price of "no inheritance, no shared state, just immutable rows" — and it's small: IFEval's Layer 1 is nine fields.

### The non-thinking recipe, field by field

Every field's source is one of: **paper** (Zhou et al., 2023, arXiv:2311.07911), **EvalScope's own registered default** (confirmed by reading its adapter and a real resolved `task_config.yaml`), or **our decision**.

```yaml
# standards/ifeval-v1-instruct.yaml
#
# IFEval, Instruct mode (no thinking). Layer 1 is identical to
# ifeval-v1-think.yaml; only the sampling block below differs.

label: ifeval/v1-instruct

# --- Layer 1: the protocol -----------------------------------------------

benchmark: ifeval
framework: evalscope
framework_image: registry.local/evalscope:2ce95c3   # see "Pinning it" above
task_name: ifeval

dataset_name: opencompass/ifeval
# Source: EvalScope's own adapter registration -- confirmed from a real
# resolved task_config.yaml, not assumed. NOT "google/IFEval": that's the
# original paper's release, and it's a different id from the ModelScope
# mirror EvalScope actually fetches. Use the literal id EvalScope resolves,
# because that's what determines what's actually in the run.

dataset_revision: null
# TODO before this leaves draft. EvalScope's dataset_args expose no revision
# knob for a ModelScope-hosted set (none appeared in a real resolved config),
# so "pinned, not merely recorded" isn't free here the way it is for a model
# checkpoint. The practical answer is probably the same one the plan already
# uses for the harness itself: download once, bake the snapshot into the
# container image at build time, and record the image tag as the pin. Needs
# a decision before this recipe is "verified", not before it's built.

split: train              # source: EvalScope. IFEval ships one split, oddly named "train".
few_shot: 0                # source: paper and EvalScope agree.
prompt_template: ""        # source: paper and EvalScope agree -- no wrapper at all.
# The empty template isn't cosmetic: IFEval's instructions include things
# like "respond in all lowercase", so any wrapper we added could itself
# violate the instruction under test.

extraction:
  method: none
  # source: EvalScope. IFEval's checkers run against the raw completion --
  # there's no separate answer-extraction step for this benchmark.

metrics:
  - name: prompt_level_strict
    display_name: "Prompt-level (strict)"
    harness_key: "prompt_level_strict:mean"
    higher_is_better: true
    is_primary: true
  - name: inst_level_strict
    display_name: "Instruction-level (strict)"
    harness_key: "inst_level_strict:mean"
    higher_is_better: true
    is_primary: false
  - name: prompt_level_loose
    display_name: "Prompt-level (loose)"
    harness_key: "prompt_level_loose:mean"
    higher_is_better: true
    is_primary: false
  - name: inst_level_loose
    display_name: "Instruction-level (loose)"
    harness_key: "inst_level_loose:mean"
    higher_is_better: true
    is_primary: false
  # harness_key is the key inside the report's raw.ifeval.metrics block --
  # verified against a real report.json, e.g. raw.ifeval.metrics["prompt_level_strict:mean"].score.
  # This corrects the illustrative key in DATA_MODEL_V1.md Section 4
  # ("prompt_level_strict_acc,none"), which is lm-evaluation-harness's naming
  # convention, not EvalScope's -- a copy from the wrong harness. EvalScope's
  # own key has no "_acc" and uses "prompt_level_strict:mean", colon-separated.

repeats: 1
# source: our decision. IFEval's own 95% CI at n=541 is already ±4 points
# (EVAL_SERVICE_PLAN.md Section 5) -- repeats is for the small benchmarks,
# not this one.

sample_limit: null   # null = the full 541 prompts. Never null on a published run.

# --- Layer 2: sampling. Legitimately depends on the checkpoint. ----------

enable_thinking: false   # this recipe is the Instruct-mode number.
think_handling: strip    # inert here -- there's no think block to strip. Kept
                          # rather than left ambiguous, per the "every column
                          # NOT NULL on purpose" rule in DATA_MODEL_V1.md Section 3.3.

temperature: 0.0          # source: our decision -- greedy, deterministic.
top_p: 1.0                 # source: vLLM's own neutral defaults, written down
top_k: -1                  # explicitly rather than omitted -- the schema's
min_p: 0.0                  # "every sampling column NOT NULL on purpose" rule
presence_penalty: 0.0        # (DATA_MODEL_V1.md Section 3.3). min_p specifically
repetition_penalty: 1.0      # never reaches vLLM regardless -- see Sharp edges (#1).
max_tokens: 8192           # source: our decision. Generous for a non-thinking
                            # 4B reply -- see CLUSTER_VALIDATION.md for why a
                            # thinking model needs far more than this.

# --- Provenance ------------------------------------------------------------
# Reference checkpoint: Qwen3-4B-allternary-ep03
#   (/home/shared/agentic_slm/models/Qwen3-4B-allternary-ep03)
# Reference score:  prompt_level_strict = 0.7412  (n = 541)
# Verified against: qvac-research-tool-call, simple_eval/results/ifeval/
#   Qwen3-4B-allternary-ep03/full-ternary-04b/run-270187, a real completed run.
```

### The thinking recipe — what actually changes

```yaml
# standards/ifeval-v1-think.yaml
#
# IFEval, thinking mode. Layer 1 is byte-for-byte identical to
# ifeval-v1-instruct.yaml above; only enable_thinking and the sampling
# block change. Repeated below in full anyway -- see "one file per row".

label: ifeval/v1-think
benchmark: ifeval
framework: evalscope
framework_image: registry.local/evalscope:2ce95c3
task_name: ifeval
dataset_name: opencompass/ifeval
dataset_revision: null   # same open item as the instruct recipe
split: train
few_shot: 0
prompt_template: ""
extraction:
  method: none
metrics:
  - name: prompt_level_strict
    display_name: "Prompt-level (strict)"
    harness_key: "prompt_level_strict:mean"
    higher_is_better: true
    is_primary: true
  - name: inst_level_strict
    display_name: "Instruction-level (strict)"
    harness_key: "inst_level_strict:mean"
    higher_is_better: true
    is_primary: false
  - name: prompt_level_loose
    display_name: "Prompt-level (loose)"
    harness_key: "prompt_level_loose:mean"
    higher_is_better: true
    is_primary: false
  - name: inst_level_loose
    display_name: "Instruction-level (loose)"
    harness_key: "inst_level_loose:mean"
    higher_is_better: true
    is_primary: false
repeats: 1
sample_limit: null

# --- Layer 2: this is the only section that differs from -instruct -------

enable_thinking: true
think_handling: strip
# "strip" here means something concrete and mechanical, not a EvalScope-side
# text filter: it means the serving_profile for this run MUST carry
# --reasoning-parser qwen3 (DATA_MODEL_V1.md's serving_profile.vllm_flags).
# With that flag, vLLM itself splits <think>...</think> out of the completion
# into a separate `reasoning_content` field before EvalScope ever sees the
# response, so the `content` EvalScope scores is already think-free -- no
# EvalScope-side --dataset-args filter needed. See "Sharp edges" (#4): this
# recipe is not servable against an endpoint whose serving_profile has no
# reasoning parser attached, and that coupling isn't visible in either table
# on its own.

temperature: 0.6            # source: Qwen3's own model-card guidance for
top_p: 0.95                  # thinking mode, and the value EVAL_SERVICE_PLAN.md
top_k: 20                    # Section 5 already cites. Independently confirmed
min_p: 0.0                   # here from a real, working sampling profile
presence_penalty: 0.0        # (qvac-research-tool-call's qwen3_think:
repetition_penalty: 1.0      # temperature 0.6, top_p 0.95, top_k 20).
max_tokens: 16384            # source: same reference profile. Big, on purpose --
                              # see Sharp edges (#5) for exactly why this number
                              # and not 512 or 8192.

# --- Provenance ------------------------------------------------------------
# Reference checkpoint: Qwen3-4B-allternary-ep03 (same as -instruct)
# Reference score: NOT YET RUN. Get one before setting this recipe's label
# and publishing anything against it -- DATA_MODEL_V1.md Section 9, step 4,
# and the "get a reference number" step in EVAL_SERVICE_PLAN.md Section 12.
# Do not fabricate a plausible-looking number here; an empty field that
# says "TODO" is worth more than a guess that looks like data.
```

Notice what's identical between the two files and what isn't: every Layer-1 field, byte for byte; every Layer-2 field, different except `think_handling` and the now-inert `min_p`/`presence_penalty`/`repetition_penalty`. That's the whole point of the split in [`EVAL_SERVICE_PLAN.md`](./EVAL_SERVICE_PLAN.md) Section 5 made concrete.

---

## 4. From a `recipe` row to an EvalScope call

Illustrative — this worker doesn't exist yet — but every field below is a real `TaskConfig`/`GenerateConfig` field, checked directly against the installed package (`evalscope==1.11.1`), not guessed from documentation:

```python
# Not yet implemented. The shape a v1 worker would build from a resolved
# `recipe` row and a live `endpoint` row.

from pathlib import Path
from evalscope import TaskConfig, run_task


def build_task_config(recipe, endpoint, run_dir: Path) -> TaskConfig:
    return TaskConfig(
        model=endpoint.model_tag,
        api_url=endpoint.url,          # the tunnel's local end
        api_key="EMPTY",
        eval_type="openai_api",        # HTTP only -- never loads the model itself
        datasets=[recipe.task_name],
        dataset_args={
            recipe.task_name: {
                # Every Layer-1 field passed explicitly, even the ones that
                # currently match EvalScope's own registered default for
                # ifeval. That's deliberate: it's what makes recipe_hash a
                # verification tool rather than a label. If a future
                # EvalScope upgrade silently changes its own default, an
                # explicit value here means our number doesn't move with it
                # -- an implicit one would, without the hash changing to say so.
                "dataset_id": recipe.dataset_name,
                "subset_list": ["default"],
                "few_shot_num": recipe.few_shot,
                "prompt_template": recipe.prompt_template,
                "metric_list": [m["harness_key"].split(":")[0] for m in recipe.metrics],
            }
        },
        generation_config={
            "temperature": recipe.temperature,
            "top_p": recipe.top_p,
            "top_k": recipe.top_k,
            "presence_penalty": recipe.presence_penalty,
            "repetition_penalty": recipe.repetition_penalty,
            "max_tokens": recipe.max_tokens,
            # min_p deliberately NOT passed here -- see Sharp edges (#1).
            # EvalScope's openai_api path drops an unrecognized key silently,
            # so passing it would claim a control that doesn't exist.
            "timeout": 1800,
        },
        repeats=recipe.repeats,
        seed=42,
        limit=recipe.sample_limit,
        eval_batch_size=32,
        work_dir=str(run_dir),
        no_timestamp=True,
        ignore_errors=True,   # one bad sample shouldn't cost the whole run;
                               # eval_run.truncation_rate and .error are what
                               # catch it costing something anyway.
    )


run_task(task_cfg=build_task_config(recipe, endpoint, run_dir))
```

After `run_task` returns, read `run_dir/reports/<model_tag>/<task_name>.json`. Two things come out of it:

- The whole file → `eval_run.results_json`, verbatim.
- For each entry in `recipe.metrics`: `report["raw"][recipe.task_name]["metrics"][metric["harness_key"]]["score"]` and `...["num"]` → one `metric` row (`name`, `value`, `n_samples`, `is_primary`).

That `raw.<task>.metrics.<harness_key>.score` / `.num` path is exact — read from a real report, not inferred from a schema.

---

## 5. How a YAML file becomes a leaderboard number

This is "how standards work," concretely.

### 5.1 The loader

Lives in `app/services/standards/` per the router → controller → library layering already in `.cursor/rules/backend-layering.mdc` — that module's docstring already says roughly this, it just hasn't been written yet. The whole thing, per [`V1_SIMPLIFICATION.md`](./V1_SIMPLIFICATION.md): *"load the file, build the dict, hash it, insert if the hash is new. About thirty lines."*

```python
# Illustrative. ~30 lines, per V1_SIMPLIFICATION.md's own estimate.

def load_standard(path: Path) -> Recipe:
    doc = yaml.safe_load(path.read_text())
    label = doc.pop("label")
    h = recipe_hash(doc)              # canonical JSON -> sha256, first 16 hex chars
    existing = get_recipe_by_hash(h)
    if existing:
        return existing               # same content -> same row, loader is idempotent for free
    return insert_recipe(doc, hash=h, label=label)
```

### 5.2 Why this makes editing a standard safe

Edit `standards/ifeval-v1-instruct.yaml` and re-run the loader: if the content actually changed, you get a **new** row with a new hash — every `eval_run` that used the old row keeps pointing at it, untouched, forever. If you change a comment or reorder keys but the hashed fields are identical, the loader finds the existing hash and does nothing. There's no migration, no version bump to remember, no "did I update every reference" — that's what content-addressing buys, and it's why [`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) calls the recipe table the one the whole design turns on.

### 5.3 What makes it "a standard" rather than someone's experiment

One nullable column: `label`. A row loaded from `standards/*.yaml` gets one (`ifeval/v1-instruct`). A row minted from a user's override at submit time — anyone changing `max_tokens` for one run — gets `label = NULL` automatically, because [`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) Section 4's override mechanism is just "build the dict, hash it, insert if new," identical code path, just without a label to attach. The Standards page is:

```sql
SELECT * FROM recipe WHERE label IS NOT NULL ORDER BY benchmark, label;
```

Rendered readably — field, value, source comment pulled straight from the YAML — that page **is** the methodology documentation [`EVAL_SERVICE_PLAN.md`](./EVAL_SERVICE_PLAN.md) Section 13 describes, and it costs almost nothing because the YAML you just wrote already has every source comment it needs.

### 5.4 Comparability without a publish gate

This is the mechanism behind the decision you made earlier in this chat — *"eliminate the concept of standard hash; allow any result comparison with UI indication for recipe hash differences"* — spelled out concretely now that `recipe` is immutable:

- Every result is visible. There's no `is_standard` flag gating what shows up.
- The leaderboard groups rows by `recipe_id` (equivalently, by hash) and colours by it. Two cells sharing a colour were produced identically; different colours is the "look before you compare" signal, with no asterisk system to maintain.
- `label IS NOT NULL` is a separate axis from "is this comparable" — it answers "is this a reviewed protocol or an ad-hoc override," not "can I trust the number." Both axes matter, neither one replaces the other.

### 5.5 The dataset-revision gap, named plainly

One honest hole worth stating rather than papering over: `dataset_revision` is `NOT NULL` in the schema, but for a ModelScope-hosted set like `opencompass/ifeval`, nothing in a real resolved `task_config.yaml` shows a pinnable revision string the way a git commit or an HF Hub snapshot hash would. Until that's resolved, the closest honest value is "whatever the container image's dataset snapshot was at build time" — which means the `framework_image` tag is, in practice, also the dataset pin, for now. Worth a real decision before `ifeval-v1-instruct` gets marked verified, not before it's built.

---

## 6. Sharp edges

Five things, each checked by reading source or a real run, not by extrapolating from documentation. Ranked by how much they can silently cost you.

**1. `min_p` is dropped, silently, for every `openai_api` run.** `evalscope.api.model.generate_config.GenerateConfig` (checked in `evalscope==1.11.1`) declares `top_p`, `top_k`, `presence_penalty`, `repetition_penalty` as real fields — but no `min_p` field at all. Its `model_config = {'extra': 'allow'}` means an unrecognized key like `min_p` doesn't raise; it's absorbed into `model_extra` and simply never read. The function that actually builds the HTTP request to vLLM, `evalscope.models.utils.openai.openai_completion_params`, reads roughly twenty named attributes one at a time (`if config.top_k is not None: params['top_k'] = ...`) and never touches `model_extra` — so `min_p` never reaches the wire. This is currently harmless in the one real reference system checked, because the only profile that sets it (`qwen3_5_think`) sets it to `0.0`, which is also vLLM's own neutral default — so nothing is actually being lost today. It would bite the day someone writes a recipe with a non-zero `min_p` expecting it to do something. **If that day comes:** route it through `extra_body` instead (`generation_config={"extra_body": {"min_p": 0.05}}`) — `GenerateConfig.extra_body` *is* a real, forwarded field, and vLLM's OpenAI-compatible server does read `min_p` as an extended (non-standard-OpenAI) request field. Confirm with one real request before trusting it for a published number; I verified the code path, not a live response. I'd also just drop `min_p` from the recipe hash and the YAML entirely until this is fixed — a column that's silently inert is worse than no column, because it looks like control that isn't there.

**2. `--generation-config vllm` isn't actually used by the one working reference system, and it gets away with it — but I'd still use it.** [`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) Section 3.1 and [`EVAL_SERVICE_PLAN.md`](./EVAL_SERVICE_PLAN.md) Section 5 both treat this flag as load-bearing, and the underlying risk is real and measured (the quoted vLLM startup warning, applying `{'temperature': 0.6, 'top_k': 20, 'top_p': 0.95, 'max_tokens': 32768}` from this exact checkpoint's `generation_config.json`). But `qvac-research-tool-call/evaluation/src/qvac_eval/serving.py`'s real `vllm serve` invocation never passes `--generation-config` at all — confirmed by reading the actual argv construction. It gets away with this because **every sampling profile in its `models.yaml` sets `temperature` explicitly on every request** (vLLM ignores top_p/top_k/etc. at `temperature=0`, and every thinking profile pins `temperature`, `top_p` and `top_k` together). Explicit per-request values still beat the checkpoint's file regardless of the flag — the flag only protects a field *nobody* set on the request. So the exposure in the reference system is narrower than the plan implies, but not zero: the day a recipe adds a new sampling field that a profile forgets to set, `--generation-config vllm` is what turns "silently uses this checkpoint's opinion" into "silently uses vLLM's own neutral default" — predictable instead of per-checkpoint. Keep the flag; just don't repeat the claim that its absence has caused a measured failure, because it hasn't, here.

**3. `dataset_name` should be `opencompass/ifeval`, not `google/IFEval`.** Covered in Section 3 above; repeated here because it's the one field that's wrong in an existing worked example ([`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) Section 4's hash JSON) and it's part of the hash. Confirmed from a real resolved `task_config.yaml`, not the public docs page (which agrees, for what it's worth: `Dataset ID: opencompass/ifeval`).

**4. `think_handling` and the serving profile's reasoning parser are coupled, and that coupling is invisible if you only look at one table.** `think_handling='strip'` is only mechanically true when the endpoint's `serving_profile.vllm_flags` includes `--reasoning-parser qwen3` (or the family's equivalent) — that's what makes vLLM split `<think>` out of the completion *before* EvalScope ever sees it, confirmed both by EvalScope's own FAQ ("enable a reasoning parser on the inference engine... the thinking content is returned in a separate `reasoning_content` field, which EvalScope picks up automatically") and by the real `qwen3` family entry in `families.yaml` (`reasoning_parser: qwen3`). A `think_handling='as_is'` recipe — scoring the whole completion, think block included — would need an endpoint whose serving profile has *no* reasoning parser, because otherwise the think text never reaches `content` for EvalScope to score in the first place. Neither table says this on its own; a recipe requesting `as_is` against a `qwen3`-family serving profile is a request that cannot do what it says.

**5. An unterminated think block scores as a hard failure, and the fix here is a diagnostic, not a patch.** When a thinking response hits `max_tokens` before closing `</think>`, vLLM's reasoning parser puts the *entire* completion in `reasoning_content` and leaves `content` empty — an empty answer, not a partial one, and IFEval scores that as wrong. `qvac-research-tool-call/evaluation/src/qvac_eval/patches.py` monkeypatches around this (`_score_unterminated_reasoning`, applied unconditionally), grading the reasoning text when a turn left no real answer behind. **I would not build that patch for v1** — it's exactly the kind of extra machinery the current scope is trying to avoid, and [`DATA_MODEL_V1.md`](./DATA_MODEL_V1.md) already has the v1-appropriate answer to this failure mode: `eval_run.truncation_rate`. A high truncation rate on a thinking recipe *is* this bug, surfacing as a number instead of a silently-wrong score, which is the whole reason that column exists. The real fix is generous `max_tokens` (`16384` above, not `512` — see [`CLUSTER_VALIDATION.md`](./CLUSTER_VALIDATION.md) for the 512-token probe that hit this exact wall); the patch is a refinement for later, not a v1 requirement.

---

## 7. Adding the next benchmark

Not repeated here — [`EVAL_SERVICE_PLAN.md`](./EVAL_SERVICE_PLAN.md) Section 12 already has the process (read the paper, read the adapter, write the YAML, get a reference number, verify). The one thing worth adding after actually doing this once for IFEval: **read the adapter by installing the pinned commit and importing it, not by reading EvalScope's docs pages.** Three separate findings in this doc — the `min_p` drop, the dataset id, and the `harness_key` format — were wrong or simply unverifiable from documentation alone, and only resolved by reading `generate_config.py`, `openai.py`, and a real resolved `task_config.yaml` directly. The docs are a fine starting point and mostly agreed with what I found here — but "mostly" is doing real work in that sentence.

---

*Verified against: `evalscope==1.11.1` from PyPI (`evalscope/api/model/generate_config.py`, `evalscope/models/utils/openai.py`, and the wheel's own `METADATA` for the `ifeval` extras group) — this is the closest available proxy for the pinned dev commit `2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85`, not that exact commit, which I don't have access to from here. And against the real `qvac-research-tool-call` checkout on this machine: `evaluation/configs/{models,families,benches}.yaml`, `evaluation/src/qvac_eval/{task,context,runner,serving,patches}.py`, `evaluation/src/qvac_eval/benches/ifeval.py`, and a complete real run's on-disk output at `simple_eval/results/ifeval/Qwen3-4B-allternary-ep03/full-ternary-04b/run-270187/` (its `configs/task_config.yaml`, `reports/.../ifeval.json`, `summary.json`, `meta.json`, and one `predictions/.../ifeval_default.jsonl` record) plus the matching smoke run at `.../smoke/run-270184/`. The IFEval paper reference (Zhou et al., 2023, arXiv:2311.07911) and the EvalScope public docs (`evalscope.readthedocs.io`, v1.7.0 and `latest`) were used for corroboration, not as the primary source, because they disagreed with the real config on one field (the dataset id) and couldn't settle another (`min_p`) at all.*
