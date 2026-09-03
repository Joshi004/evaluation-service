# Cluster Validation — What Actually Works

**Date:** 3 Sep 2026
**Companion to:** [`EVAL_SERVICE_PLAN.md`](./EVAL_SERVICE_PLAN.md)
**What this is:** the results of driving the cluster by hand before writing any service code. Every number here was measured, not estimated. Where I didn't verify something, it's in [Section 9](#9-what-i-did-not-verify).

The plan doc assumes a lot about the cluster. This is the check on those assumptions. The short version: **the architecture holds up — all six connector methods work today — but four things came out of it that change the design, and one of them is a correctness problem rather than a plumbing problem.**

> **Status, after review.** All four findings have been dispositioned and `EVAL_SERVICE_PLAN.md` is updated to revision 4. Two led to design changes, two were deliberately deferred:
>
> | Finding | Disposition |
> |---|---|
> | 3.1 Crashed server burns the readiness timeout | **Fixed** in the serve template (liveness check). Automatic reaping of *idle* servers is separately **deferred** to a periodic sweeper. |
> | 3.2 Checkpoint overrides our sampling | **Design changed.** Sampling, think handling and `max_tokens` each become a three-way selectable source, with the resolved values hashed. |
> | 3.3 Think block consumes the whole budget | **Design changed**, same mechanism. The remaining open item is the *default*, which is a human call. |
> | 3.4 Cluster is in Portugal | **Deferred.** Noted, parked, revisit only if it becomes a practical problem. |
>
> Sections 3 and 5 below keep the original measurements and note the resolution inline.

---

## Table of contents

1. [The one-paragraph version](#1-the-one-paragraph-version)
2. [The six connector methods](#2-the-six-connector-methods)
3. [Four findings that change the plan](#3-four-findings-that-change-the-plan)
4. [The vLLM serve path, in detail](#4-the-vllm-serve-path-in-detail)
5. [Latency, and where the control plane might eventually matter](#5-latency-and-where-the-control-plane-might-eventually-matter) *(deferred)*
6. [NFS is slower than the plan assumes](#6-nfs-is-slower-than-the-plan-assumes)
7. [Answers to open questions in the plan](#7-answers-to-open-questions-in-the-plan)
8. [What changed in the plan as a result](#8-what-changed-in-the-plan-as-a-result)
9. [What I did not verify](#9-what-i-did-not-verify)
10. [Reference data](#10-reference-data)

---

## 1. The one-paragraph version

I SSHed to the login node, reached compute nodes directly, submitted four jobs, watched their status, streamed their logs, cancelled them, opened a tunnel from my laptop through the login node to a compute node, and served Qwen3-4B on an H100 with vLLM and got real generated tokens back. All of it worked with no help from anybody and nothing installed on the cluster. The design in Section 6 of the plan is sound. The problems were elsewhere: a model server that crashes on startup holds its GPUs for the entire readiness timeout, the checkpoint's own `generation_config.json` silently supplies sampling defaults underneath our config, and this model spends its whole token budget thinking and never answers. The first is fixed with three lines; the other two reshaped Section 5 of the plan into a choose-and-hash design. Total cost of finding all this out: about 0.33 GPU-hours.

---

## 2. The six connector methods

The plan proposes a narrow interface — `submit`, `status`, `cancel`, `logs`, `stage_file`, `open_tunnel`. All six work today over plain SSH.

| Method | How | Result |
|---|---|---|
| `submit` | `ssh cluster sbatch` | Job `285684`, exit 0, **zero queue wait** |
| `status` | `squeue`, `scontrol show job`, `sacct` | All three work; `scontrol` gives structured output |
| `logs` | `cat`, and `tail -f` | Live streaming confirmed, one line per second |
| `cancel` | `scancel` | Job → `CANCELLED`, recorded in `sacct` |
| `stage_file` | `scp` / shared NFS | `$HOME` and `/home/shared` writable from login and compute |
| `open_tunnel` | `ssh -J login node -L …` | Laptop → login → compute node → HTTP 200 |

Connection details worth carrying into the implementation:

- **Key-based auth works unattended.** `BatchMode=yes` succeeded, so no password or agent prompt.
- **Connection reuse is load-bearing, not an optimization.** A cold SSH connect takes **16 seconds**; with `ControlMaster`/`ControlPersist` it's about **1 second**. `asyncssh` should hold a pool open.
- **The login node is busy.** Load average was ~17 throughout. Consistent with the plan's "fragile pod, we only knock" decision.
- **Compute nodes are reachable with no active job.** `ssh toolcall-12` and `ssh vlm-10` both worked from the login node, and `ProxyJump` from my laptop straight to a compute node worked too. This is what makes the tunnel design possible.

### `sbatch` accepts the script on stdin

This one is a small but real win. I submitted with:

```bash
ssh cluster 'sbatch --chdir=$HOME/run-dir --parsable' < local_script.sbatch
```

Nothing was written to the cluster first. The plan lists inline script submission as a reason to want `slurmrestd` deployed:

> Submit — `POST /slurm/v0.0.44/job/submit` — Body is `{"script": …}` — **the script goes inline**, so no file has to exist on the cluster first

We already have that over SSH, which weakens the case for that ask. One consequence to handle: `scontrol show job` then reports `Command=(null)`, so if we want the script path recorded for auditing we have to store it ourselves. `SubmitLine` is preserved.

---

## 3. Four findings that change the plan

### 3.1 A crashed model server burns the full readiness timeout on a GPU

This is the most important operational finding, and I hit it by accident.

My first serve job passed `--disable-log-requests`, which vLLM removed by 0.19. vLLM exited on an argparse error within seconds. My readiness loop — copied from the plan's description, polling `GET /v1/models` until the served name appears — **kept polling a dead process and held one H100 for 10 minutes and 46 seconds** doing nothing at all.

The plan's Challenge 4 is "orphaned model servers burning H100s", and its defences are TTL, idle timeout, heartbeat and a reaper. Those all assume a server that came up and was then forgotten. This is the opposite case: a server that never came up, where the readiness check itself is what holds the GPU. At the plan's proposed 900-second timeout, every misconfigured serve job costs 15 minutes of H100 time.

The fix is three lines in the serve template:

```bash
for i in $(seq 1 180); do
    if ! kill -0 "${VLLM_PID}" 2>/dev/null; then
        echo "SERVER_DIED after $((i * 5))s -- exiting instead of waiting out the timeout"
        wait "${VLLM_PID}"; echo "server exit code: $?"
        exit 1
    fi
    if curl -sS -m 3 "http://localhost:${PORT}/v1/models" 2>/dev/null | grep -q "${SERVED_NAME}"; then
        echo "READY after $((i * 5))s"; READY=1; break
    fi
    sleep 5
done
```

The reconciler should treat `SERVER_DIED` as a distinct terminal state from `READINESS_TIMEOUT`, because they mean different things: the first is a bad config we should surface immediately, the second is a slow load we might retry.

**Resolution.** The liveness check is adopted — it's three lines and it stops the waste at its source. The broader orphaned-server machinery the plan originally proposed (TTLs, idle timeouts, service heartbeats, a reaper woven through the MVP) is **deferred**: it'll be handled later by a periodic sweeper that looks for GPU nodes allocated to us but sitting idle. The one rule that stays non-negotiable in the meantime is an explicit `--time` on every job, which bounds the damage by construction. Worth being clear that these are two different problems that happen to have the same symptom — a server that *never came up* versus one that *came up and was forgotten*. The liveness check only addresses the first.

### 3.2 The checkpoint silently overrides our sampling standard

Section 5 of the plan is built on two layers — a benchmark protocol we fix, and a model profile that follows the vendor's published recommendation. Layer 2 is not currently authoritative. vLLM logged this on startup:

```
WARNING [model.py:1435] Default vLLM sampling parameters have been overridden
by the model's `generation_config.json`:
{'temperature': 0.6, 'top_k': 20, 'top_p': 0.95, 'max_tokens': 32768}.
If this is not intended, please relaunch vLLM instance with
`--generation-config vllm`.
```

The checkpoint ships its own sampling defaults, and vLLM applies them. Explicit per-request parameters still win, so this is not a silent corruption of values we *do* set — it's a silent default for every value we *don't*. Since these defaults live in the checkpoint and vary from checkpoint to checkpoint, two models evaluated under the same recipe can be sampled differently, which is exactly what Section 5 exists to prevent.

Worse, `recipe_hash` would not catch it. The hash covers our config; this happens underneath our config.

**Resolution — this drove the main design change.** Rather than picking one winner, the source becomes an explicit choice, made in the UI per run, from three options:

1. **Benchmark default** — the value in our recipe YAML. The default, and what the leaderboard shows.
2. **User provided** — entered at submit time.
3. **From the checkpoint** — read out of its `generation_config.json`.

Whichever is chosen, the service **resolves it to concrete values and pins them explicitly** rather than letting anything fall through. Concretely that means launching with `--generation-config vllm` so the checkpoint's file is never applied implicitly, and setting every sampling field on every request — *including* when the chosen source is the checkpoint, in which case we read its config ourselves and pass those values deliberately. The distinction between "the checkpoint's settings were used" and "the checkpoint's settings leaked in" is the whole point.

Every run then stores the source, the resolved values, and a **`profile_hash`** computed over what was actually used. The leaderboard groups by that hash, so numbers produced differently can't quietly share a ranking. Full write-up in Section 5 of the plan.

### 3.3 The think-block problem is more severe than the doc suggests

Section 18's question 3 asks how a standard should treat a reasoning model's think block, and frames it as a methodological judgement call. It's more urgent than that.

I asked the model `"What is 17 * 23? Answer with just the number."` with `max_tokens: 512` and `temperature: 0`. It produced 512 tokens of `<think>` — working the arithmetic three separate ways, all correctly reaching 391 — and hit `finish_reason: "length"` **without ever emitting an answer.** In the concurrency test, **12 out of 12 responses hit `max_tokens`.** Truncation rate: 100%.

This has two consequences:

- Option 2 from Section 5 ("check the whole output, faithful to the paper") doesn't merely score reasoning models poorly, it scores them on output they never produced. For this checkpoint on IFEval with any modest token budget, the answer is not "near zero", it's "zero, measuring our token budget".
- It's strong evidence for the plan's **truncation-rate diagnostic**. That diagnostic would have flagged this on the very first run, before anyone published a number. It's a one-line count and it earns its place immediately.

It also means `max_tokens` in the recipe is not a minor field for thinking models — it's load-bearing, and the standard needs a defensible value with a stated source rather than a harness default.

**Resolution.** Think handling and `max_tokens` get the same three-way treatment as sampling, and both feed the `profile_hash`, so all three options stay available and none of them is hidden. What's *not* resolved is the **default**, which is what the leaderboard actually shows. My recommendation is `strip`, on the evidence above. That's now question 3 in Section 18 of the plan, reframed from "an open methodological question" to "a decision blocking a meaningful IFEval number for half the fleet".

### 3.4 The cluster is in Portugal, not AWS eu-central-1 — *deferred*

The login node's egress IP geolocates to **Sines, Setúbal, Portugal**, AS59437 Northern Data AG. The plan repeatedly refers to `eu-central-1` because that's where the S3 bucket lives, but the compute is somewhere else. That turns Section 9's "the harness runs on our server" from an architectural choice into a placement decision with a measurable cost — 410 ms per request from where I measured versus 6 ms in-cluster.

**Resolution: parked, deliberately.** We're not designing around this now. The tunnel handled 12 concurrent requests without trouble, so concurrency hides most of the cost, and the rest is speculative until we're running real benchmark volumes. Revisit if it shows up as an actual problem rather than a theoretical one. The measurements are kept in [Section 5](#5-latency-and-where-the-control-plane-might-eventually-matter) so nobody has to re-derive them later.

---

## 4. The vLLM serve path, in detail

Job `285727`: 1 GPU, 8 CPUs, 64 GB, `--time=00:25:00`, partition `main`, landed on `health-35`. Served `/home/shared/agentic_slm/models/Qwen3-4B-allternary-ep03` using the existing venv at `…/qvac-research-tool-call/evaluation/venv/vllm` (vLLM 0.19.0, Python 3.11).

**It worked.** `/v1/models` returned the served name, and a chat completion from my laptop returned real tokens.

### Cold start is about six minutes

`READY after 350s`. The breakdown from the logs:

| Phase | Time |
|---|---|
| Python imports from the NFS-hosted venv | **~128s** — job start 10:18:44, vLLM's first log line 10:20:52 |
| Loading the 8 GB safetensors shard | **79.8s** (~100 MB/s off the VAST mount) |
| Engine init — profile, KV cache, warmup | **71.6s** |
| &nbsp;&nbsp;└ of which `torch.compile` | 53.1s |
| &nbsp;&nbsp;└ of which CUDA graph capture | 4s |
| API server startup and the rest | remainder to 350s |

Those phases nest rather than sum — `torch.compile` happens inside engine init. The three top-level rows account for roughly 280 of the 350 seconds.

This makes **endpoint reuse worth considerably more than the plan estimates.** Section 4 lists "one served model can be hit by five benchmarks instead of loaded five times" as a benefit of decoupling; at six minutes of H100 time per load, five benchmarks against one endpoint saves half an hour of GPU time per checkpoint. The plan's 900-second readiness timeout is well-judged — 350s of real startup leaves sensible headroom.

Resource facts from the run: 70,635 MiB of 81,559 MiB GPU memory used at `--gpu-memory-utilization 0.85`, KV cache 57.32 GiB / 417,408 tokens, max concurrency 50.95× at 8,192 tokens per request. A 4B model at this context length is comfortably a one-GPU job.

### The job-ID-derived port works

The plan says to carry over tool-call's `8000 + (job_id % 250) * 8`. Job `285727` → port `9816`, as computed. Worth keeping.

### Tunnel throughput is not a bottleneck, but tunnels need supervision

Twelve concurrent chat completions through a **single** SSH tunnel:

| | |
|---|---|
| Succeeded | 12 / 12 |
| Wall clock | 1.77s |
| Output tokens | 2,400 |
| Aggregate | **~1,360 tok/s** |
| Per-request | 1.52–1.72s |
| Truncation | 12 / 12 hit `max_tokens` |

So one tunnel comfortably carries a parallel harness. Two operational caveats, both of which cost me a test:

- **A tunnel died unprompted between two commands.** Nothing had cancelled it. Tunnels need `ServerAliveInterval`, `TCPKeepAlive`, `ExitOnForwardFailure=yes`, and a reconnect path in the connector. This belongs in the same reconciler philosophy as the login-node pod restart: a dropped tunnel is a reconnect, not an incident.
- **Never cache the node name.** I tunneled to a hostname left over from a previous, cancelled job and got a connection reset. The `endpoint` table stores `node` and `port`; the reconciler must refresh `node` from `squeue` rather than trusting the row. A stale hostname fails in a way that looks exactly like a dead server, which will waste somebody's afternoon if we don't handle it explicitly.

---

## 5. Latency, and where the control plane might eventually matter

> **Deferred.** This section is recorded for later, not acted on now. Everything below is measured and correct; the decision was to park it and revisit only if it becomes a practical problem. Skip it unless benchmark wall-clock times start looking wrong.

I measured the same HTTP endpoint from two places:

| From | Per-request |
|---|---|
| My laptop (Bangkok) → login → compute node | **410 ms** |
| Login node → compute node | **6–7 ms** |

That's a **60× difference**, and it's entirely geography — Bangkok to Portugal and back. It is not tunnel overhead, not SSH, and not something we can engineer away.

The consequence for Section 9: "the harness runs in a container on our own server" is correct, but *our server* has to be near the cluster. An eval harness makes one request per prompt. IFEval is 541 prompts; GSM8K is 1,319. At 410 ms of pure round trip, a sequential IFEval run spends about **3.7 minutes doing nothing but waiting on the network**, before a single token is generated, on every run, for every benchmark. Concurrency hides most of that — the 12-way test showed the tunnel handles parallelism fine — but it doesn't remove it from tail latency, and it multiplies across the seven-benchmark waves in Section 12.

**If this ever needs acting on**, the answer is to put the control plane near the cluster — Portugal ideally, or somewhere in Europe such as `eu-central-1`, which should be tens of milliseconds rather than hundreds. Somewhere outside Europe would be the problematic case. Nothing to do today; the 410 ms figure was measured from a laptop in Asia, which is not where the service will run, so it's an upper bound on a scenario we don't plan to be in. This should be added to Section 18 as a question that needs a human answer, because it likely has procurement implications.

One incidental note: **ICMP is blocked** (`ping` gets 100% packet loss) while TCP works fine. Any health check we write must be TCP-based.

---

## 6. NFS is slower than the plan assumes

Section 3 says "Space is not a constraint", which is true — 586 TB with 133 TB free, 78% used. But throughput and metadata operations are a constraint, and the plan doesn't mention it.

Measured:

- Reading the 8 GB safetensors shard: **79.8s**, about 100 MB/s.
- `find -maxdepth 4` over the eval tree: **47 seconds**.
- A recursive `grep` over `slurm/` and `services/`: **never returned.** I killed it after three minutes.
- Python imports for vLLM from the NFS-hosted venv: roughly two minutes before the process emitted its first log line, sitting in `D` state (uninterruptible disk wait) the whole time.

This matters in three places:

1. **Model load time**, covered above — it's most of the six-minute cold start.
2. **The `summary.json` importer in Milestone 0.** Walking the results tree to find those files will be slow. Don't write it as a naive recursive scan with a progress bar and hope; constrain the depth, cache what's found, and expect the first run to take minutes.
3. **Anything that shells out to `find` or `grep` on the cluster** should be treated as a potentially unbounded operation with a hard timeout.

Related: SLURM control commands have **wildly variable latency**. `sbatch` took 29 seconds once and 974 ms another time; `scontrol show job` took 27 seconds; a `sacct` query took 47 seconds. This is independent evidence for the plan's reconciler design — **one bulk `squeue` per tick, never a per-job poll** — and it means every SSH call needs a generous timeout and a retry that doesn't assume the previous call failed just because it was slow.

---

## 7. Answers to open questions in the plan

Section 18 lists nine questions. Two are now answered, and one needs adding.

### Q7 — "Do compute nodes have S3 egress?" — **Yes.**

Challenge 15 called this "the one thing I couldn't verify without submitting a job". I submitted the job. From inside job `285684` on `health-24`:

| Endpoint | HTTP |
|---|---|
| `https://s3.eu-central-1.amazonaws.com` | **307** |
| `https://tether-ai-dev.s3.eu-central-1.amazonaws.com` | **403** |
| `https://huggingface.co` | **200** |
| `https://pypi.org/simple/` | **200** |

The 403 is the useful one: the bucket hostname resolves and answers, we're simply unauthenticated. So the Section 7 design — S3 pulls straight to the cluster, bytes never passing through our server — is viable, and the SSH-from-login-node fallback isn't needed.

Supporting facts from the same job: the **`aws` CLI is already installed** at `/usr/local/bin/aws`. **`s5cmd` is absent**, as the plan assumed — using it would mean shipping the binary ourselves. `docker` is present at `/usr/bin/docker`, which is more than the plan expected, though I did not test whether the daemon is usable. `podman`, `apptainer` and `singularity` are all absent.

**The skip path matters as much as the sync.** Since staging is now confirmed workable, the plan makes explicit what was previously implied: a run checks for a verified `artifact_location` before doing anything, and skips the sync entirely when the weights are already on the cluster. Three details make that check trustworthy rather than merely fast — a per-checkpoint lock so simultaneous runs don't race into the same directory, a `ready` state that means *verified against the registered object count and byte total* rather than *the job exited 0*, and the observation that a checkpoint already sitting on the NFS is the same code path with a row that no staging job created. Given that NFS writes are unlikely to beat the ~100 MB/s the read side measured, not re-syncing is worth real time. 

### Q6 — "Where should staged weights live?" — **partially answered.**

`/home/shared` is `drwxrwsr-x root:shared` and my account is in group `shared` (gid 1008), so we can create `/home/shared/eval-service/`. I deliberately did **not** create it — that's a shared namespace and it should be someone's decision, not a side effect of a probe. The space cap question is still open.

### Q3 — "How do we handle thinking models on IFEval?" — **mechanism settled, default still open.**

Think handling is now a selectable Layer 2 setting captured in the profile hash, so all three options exist and none is hidden. What still needs a human is the *default*, because that's what the leaderboard shows. The measured evidence in [Section 3.3](#33-the-think-block-problem-is-more-severe-than-the-doc-suggests) argues for `strip`, and makes this more urgent than the plan originally framed it.

### A question raised and then parked — **where does the control plane run?**

Per [Section 5](#5-latency-and-where-the-control-plane-might-eventually-matter). Being near the cluster would be better, and the numbers say so, but we've agreed not to design around it until it causes a real problem. Recorded rather than escalated.

---

## 8. What changed in the plan as a result

All of these are now applied in `EVAL_SERVICE_PLAN.md` revision 4.

| Section | Change |
|---|---|
| 5 | **Rewritten.** Layer 2 becomes three settings — sampling, think handling, `max_tokens` — each chosen from three sources (benchmark default, user provided, from the checkpoint). Every run stores `resolved_profile` and a `profile_hash` computed over what was actually used. The leaderboard groups by hash. |
| 5 | Launch with `--generation-config vllm` and set every sampling field explicitly, so the checkpoint's file is never applied implicitly. |
| 5 | Think handling reframed with the measured evidence; `max_tokens` called out as load-bearing for thinking models rather than a harness default. |
| 5 | Truncation rate promoted from a good idea to a demonstrated need — 100% on the Milestone 1 checkpoint. |
| 3 | NFS throughput numbers added. "Space is not a constraint" is true and misleading on its own. SLURM command latency and the 16s-vs-1s connection cost added. |
| 6 | `sbatch` reads from stdin, so inline submission is no longer a reason to want `slurmrestd`. Connection pooling, tunnel keepalives, bulk `squeue` polling, and never caching the node name. |
| 7 | Compute-node egress confirmed. Staging gains an explicit skip-if-already-staged path with a lock and a verified `ready` state. |
| 10 | `sampling_source` / `think_source` / `max_tokens_source`, `resolved_profile`, `profile_hash` on `eval_run`; verification fields on `artifact_location`; note that `endpoint.node` is a cache. |
| 11 | Liveness check in the serve template; realistic cold-start numbers; a new prerequisite to establish what profile produced the reference `0.65` before attempting parity. |
| 13 | Endpoints page reframed around the manual kill button, since automatic reaping is deferred. |
| 14 | Leaderboard comparability restated as "guaranteed within a hash, visible across them". |
| 17 | Challenge 15 closed. Challenge 4 deferred to a periodic sweeper. Two new challenges (checkpoint override, crashed-server GPU burn) and two new entries (NFS throughput, control-plane distance). |
| 18 | Q7 closed, Q6 partly answered, `slurmrestd` downgraded, think-handling default reframed as urgent, new question about the reference profile. |

**Deliberately not acted on:** control-plane placement (Section 5 here) and automatic orphan reaping beyond the liveness check (Section 3.1 here). Both are recorded for when they matter.

---

## 9. What I did not verify

Being explicit, because the gaps matter as much as the results.

- **S3 with real credentials.** I confirmed the bucket is *reachable* (403). I did not test `sts:AssumeRole`, scoped credentials, or an actual `aws s3 sync` from a compute node. The credential problem in Section 7 is untouched and still needs a human.
- **The Docker daemon on compute nodes.** The binary exists; I didn't try to run a container.
- **Multi-GPU / tensor parallel.** Everything was `--tensor-parallel-size 1` on a 4B model.
- **Any actual harness run.** I served a model and called it directly. I did not run EvalScope, did not produce a benchmark score, and did not attempt the Milestone 1 parity check against `prompt_level_strict = 0.65`. That remains the real gate.
- **Whether the throughput numbers mean anything.** 1,360 tok/s aggregate was 12 short requests against a warm 4B model. It says the tunnel isn't a bottleneck; it is not a performance benchmark.
- **`slurmrestd`.** Confirmed absent (nothing listening on 6820). I didn't ask anyone to deploy it.
- **Sustained or concurrent load on the login node.** I was one user running short commands. The 16s cold-connect and variable `sbatch` latency were measured under whatever load happened to exist at the time.
- **Node stability over hours.** The longest job ran 10m46s.

One correction worth recording, since it nearly became a false finding: at one point I believed a job had been requeued onto a different node mid-run, which would have been a significant problem for the `endpoint` table. It hadn't. I had tunneled to a hostname belonging to an earlier, cancelled job. `Restarts=0` and an unchanged `StartTime` confirmed the job never moved. **There is no evidence of job migration on this cluster.** The real lesson is the one in Section 4 — read the node fresh — not a requeue risk.

---

## 10. Reference data

### Cluster

```
SLURM        25.11.3
login node   login-6 (85.234.64.146), load average ~17
location     Sines, Setúbal, Portugal — AS59437 Northern Data AG
identity     uid=1010(naresh) gid=1002(slurmusers)
             groups: users(100), docker(999), shared(1008)
             Account=(null)  QOS=normal  Priority=1
slurmrestd   not deployed (nothing listening on 6820)
scontrol token  works — JWT auth is on
```

Partitions at probe time — `main` is the whole cluster, as the plan says:

```
PARTITION  NODES(A/I/O/T)  NODELIST
main*        100/50/0/150  health-[0-49], toolcall-[0-49], vlm-[0-49]
health          46/4/0/50  health-[0-49]
toolCall       39/11/0/50  toolcall-[0-49]
VLM            15/35/0/50  vlm-[0-49]
```

Per compute node: 8× H100 80GB, 224 CPUs, 2,015 GB RAM. A CPU-only job correctly saw **no** GPUs (`CUDA_VISIBLE_DEVICES` unset), so cgroup isolation works. Note that `nvidia-smi` run over SSH *outside* a job's cgroup shows all 8 GPUs as free regardless of what's allocated — don't use it to build the Endpoints page.

Filesystem: VAST NFS, 586T total / 454T used / 133T free (78%), same mount serves `/` on the login node.

### Jobs submitted

| Job | Purpose | Resources | Elapsed | Outcome |
|---|---|---|---|---|
| `285684` | CPU probe — egress, tooling, logs | 2 CPU, 4G | 00:00:10 | COMPLETED |
| `285688` | Fake OpenAI endpoint — tunnel test | 2 CPU, 4G | 00:02:22 | CANCELLED (by me) |
| `285710` | vLLM — **failed on bad flag** | 8 CPU, 64G, 1 GPU | 00:10:46 | CANCELLED — wasted GPU |
| `285727` | vLLM — succeeded | 8 CPU, 64G, 1 GPU | 00:08:50 | CANCELLED (by me) |

Total ≈ 0.33 GPU-hours. All jobs carried an explicit `--time`, per the plan's rule. Nothing was left running and all probe files were removed from the cluster.

### GPU-hours are available from `sacct`

`AllocTRES` carries `gres/gpu=<n>` and `ElapsedRaw` carries seconds, so GPU-hours is a multiplication. Confirmed against the plan's reference IFEval run, which is still in the accounting database:

```
270184  qe-ifeval-Qwen3-4B-allt+  toolCall
        billing=8,cpu=8,gres/gpu=1,mem=64G,node=1   00:03:39  COMPLETED
```

### The existing tool-call install

At `/home/shared/agentic_slm/qvac-research-tool-call/evaluation`:

- `slurm/run_cell.sbatch` — one job per (model, benchmark) cell. Deliberately has **no `#SBATCH` directives**; resources come from `configs/cluster.yaml` via the submitting process, so the two can't drift apart. Worth copying.
- `venv/` — five separate environments: `acebench`, `live_code_bench`, `scorer`, `tau3`, `vllm`. Confirms the plan's containers-per-framework argument.
- `services/endpoints/*.url` — endpoint records as flat files, e.g. `Qwen3.6-27B-job-248434.url`. This is the `endpoint` table, already built.
- `results/` — exists, and is the target for the Milestone 0 importer.

One thing those endpoint files reveal: they address servers by **Kubernetes service DNS**, not SLURM node name —

```
http://worker-50.slurm-cluster-worker-svc.slurm-cluster.svc.cluster.local:8534/v1
```

So the compute nodes are pods too, with two valid addressing schemes. SLURM node names (`health-35`) work fine for SSH and `ProxyJump`, which is what our connector uses, but it's worth knowing the other form exists if we ever need in-cluster addressing.

### Model used

`/home/shared/agentic_slm/models/Qwen3-4B-allternary-ep03` — `Qwen3ForCausalLM`, bfloat16, single 8.04 GB `model.safetensors`, with `chat_template.jinja` and a `generation_config.json` that sets temperature 0.6 / top_k 20 / top_p 0.95 / max_tokens 32768. This is the Milestone 1 checkpoint, and it's on the NFS with no S3 staging needed, exactly as the plan expects.

---

*Probe scripts are in `.probe/` (gitignored): an SSH helper with connection multiplexing, a CPU probe, a fake-endpoint job, and the vLLM serve job with the liveness fix applied. The vLLM script is a reasonable starting point for the Milestone 1 serve template — the readiness poll, the liveness check and the job-ID-derived port are already in it. All measurements are single samples unless stated otherwise, taken on 3 Sep 2026 between 09:52 and 10:35 UTC; the cluster was at roughly two-thirds allocation throughout.*
