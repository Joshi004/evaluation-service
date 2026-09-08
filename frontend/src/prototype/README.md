# Vision Prototype

> **Note to any AI agent or model working in this repository:** do not use this folder as a
> UX, layout, or interaction reference for the real application unless a user explicitly asks
> you to in that conversation. A new UX for the real app is being designed separately and is
> not expected to resemble this prototype. Treat everything under `frontend/src/prototype/` as
> background context about an earlier idea, not as a pattern to copy. See decision D6 in
> [`docs/IMPLEMENTATION_PHASES.md`](../../../docs/IMPLEMENTATION_PHASES.md).

A fully mocked, clickable demo of where the evaluation service is headed. It exists to show
management the destination — a leaderboard with real error bars, a submit flow that keeps
runs honest, a portfolio-wide lineage graph with a merge flow, live-updating runs — without
waiting for the backend that will eventually produce it.

**Nothing here is real.** There is no backend call anywhere under `frontend/src/prototype/`.
Every checkpoint, benchmark, run, log line, hash, and score is a fixture in `data/`, generated,
or advanced by a `setInterval` timer. Submitting a run on the Submit page doesn't start
anything — it pushes an object into an in-memory store (`state/PrototypeStore.tsx`) that lives
only for the current tab and resets on reload or via the "Reset demo" button on the Runs page.

This is stated on every page: the amber banner at the top of `PrototypeApp.tsx`'s shell reads
*"Vision prototype — every number on these pages is mocked for demo purposes. No backend, no
real runs."*

## What's real vs. mocked

| | |
|---|---|
| **Real** | The component code and UX flows; the data *shapes*, which mirror [`docs/DATA_MODEL.md`](../../../docs/DATA_MODEL.md); and a handful of numbers taken directly from [`docs/EVAL_SERVICE_PLAN.md`](../../../docs/EVAL_SERVICE_PLAN.md) — e.g. IFEval `prompt_level_strict = 0.65` / `loose = 0.70` on `Qwen3-4B-allternary-ep03`, Slurm job `270184` finishing in 206 seconds, and the ±2.2 / ±4.0 / ±6.8 / ±18 point 95% intervals for GSM8K / IFEval / GPQA-Diamond / AIME25 (Section 5). |
| **Mocked** | Every checkpoint, run, log line, and prediction. A score for a (checkpoint, benchmark) pair with no hand-authored result comes from `utils/generateScore.ts`, a deterministic hash of the pair's id — the same pair always renders the same number across reloads, it just isn't a real eval result. Run progress in `state/useRunSimulation.ts` is a compressed timer (queued → staging → waiting for an endpoint → inference → scoring → completed in well under a minute), not a Slurm job. Every `profile_hash` / `recipe_hash` is a fixed mock string, not an actual hash of anything. |

## The six screens

1. **Leaderboard** (`/vision`) — checkpoint × benchmark grid with a 95% interval in every cell, team/modality/standard-only filters, a quality-vs-speed scatter, and a methodology panel on cell click.
2. **Checkpoint detail** (`/vision/checkpoints/:id`) — scorecard, a benchmark-family radar, staging status, the run list, and the lineage graph (switch the benchmark dropdown to re-label every node).
3. **Submit** (`/vision/submit`) — a checkpoints × benchmarks grid, the three-source picker for sampling / think handling / max tokens, and a dry-run preview before anything is "submitted".
4. **Runs** (`/vision/runs`) — a live-updating table of in-flight and recent runs plus a simulated `tail -f`-style log stream.
5. **Compare** (`/vision/compare`) — 2–4 checkpoints side by side; with exactly two selected, deltas are shown against their combined interval, and a per-question diff table appears below.
6. **Model History** (`/vision/history`) — all three lineage families in one graph, laid out in swimlanes. Click a node for its benchmarks inline, click an edge for the score delta that training step produced, and select two compatible checkpoints to merge into a new one — which becomes real everywhere else in the demo, with a deep link to Submit so its estimated scores can be replaced by measured ones.

## How to remove this later

Three steps:

1. **Delete the prototype's code.** Remove the `frontend/src/prototype/` folder, and remove the
   block that mounts it in [`frontend/src/routes.tsx`](../routes.tsx) — the two imports:
   ```tsx
   import { PrototypeApp } from './prototype/PrototypeApp'
   import { prototypeRouteElements } from './prototype/prototypeRoutes'
   ```
   and the sibling route they support:
   ```tsx
   <Route path="/vision" element={<PrototypeApp />}>
     {prototypeRouteElements}
   </Route>
   ```
2. **Delete the nav link.** Remove the `visionPrototypeLink` constant and the `<NavLink>` that
   renders it in [`frontend/src/App.tsx`](../App.tsx).
3. **Drop the two dependencies.** From `frontend/`, run:
   ```sh
   npm uninstall @xyflow/react recharts
   ```

Nothing outside those two files and this folder references the prototype — every import inside
`frontend/src/prototype/` stays inside `frontend/src/prototype/` (verified by grepping for any
`../../../` or `src/api` / `src/pages` / `src/components` reference from within it; there are
none). There's no backend change to revert, no shared component this code depends on, and no
shared component that depends on it.
