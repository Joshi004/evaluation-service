// Phase 5 (docs/UI_REDESIGN_PLAN.md §8.5): the compare tray's own
// rules, kept as a pure module (no React, no DOM) so a later phase can
// reuse them from anywhere a run can be pinned -- Runs today, the
// Leaderboard and Model page once Phases 6 and 11 add their own pin
// controls (Appendix A: "useCompareTray(), AddToCompareButton,
// MAX_COMPARE_RUNS" is the contract phases 6-11 read from).

import type { RunListItem } from '../api/client'

// Raised to 4 in Phase 8, once the compare page itself supports more
// than two runs (today's ComparePage only reads ?left=&right=).
export const MAX_COMPARE_RUNS = 2

// What a caller offers to pin -- source-neutral so a future caller (a
// LeaderboardRow, which has no run status or checkpoint name of its
// own) can still build one of these without inventing a second shape.
export interface CompareCandidate {
  runId: number
  status: string
  benchmark: string
  comparisonHash: string
  modelName: string
  samplingProfileLabel: string | null
  samplingProfileHash: string
  scoreFraction: number | null
}

// What actually lives in the tray -- every CompareCandidate field
// except `status`: a pinned run always passed the "done" check to get
// in, and nothing in the tray ever re-runs, so carrying status further
// would only invite a stale read of it.
export type PinnedRun = Omit<CompareCandidate, 'status'>

// One reason a pin attempt didn't take. Kept as its own type instead
// of the reason string itself, so the wording lives in one place
// (pinRefusalReason) and can change without touching the rule that
// decided it.
export type PinRefusal = 'already-pinned' | 'not-finished' | 'other-benchmark' | 'limit-reached'

export type SetupMatch = 'same' | 'different' | null

export function compareCandidateFromRun(run: RunListItem): CompareCandidate {
  return {
    runId: run.id,
    status: run.status,
    benchmark: run.benchmark,
    comparisonHash: run.comparison_hash,
    modelName: run.checkpoint_name,
    samplingProfileLabel: run.sampling_profile_label,
    samplingProfileHash: run.sampling_profile_hash,
    scoreFraction: run.primary_metric_value,
  }
}

// The same shape, built from the Leaderboard's own reshaped board data
// (utils/buildLeaderboard.ts's ScoreCellData/SetupOption/ModelRow)
// instead of a RunListItem -- by the time a cell or a By-benchmark row
// can offer a pin, the raw LeaderboardRow it came from has already been
// folded into that shape. GET /leaderboard's own WHERE clause only ever
// returns `done` runs, so this always reports 'done' rather than
// reading a status field the board doesn't carry.
export function compareCandidateFromLeaderboardCell(params: {
  runId: number
  benchmark: string
  comparisonHash: string
  modelName: string
  samplingProfileLabel: string | null
  samplingProfileHash: string
  scoreFraction: number
}): CompareCandidate {
  return { ...params, status: 'done' }
}

// Exported so CompareTrayProvider can build the same shape when a pin
// succeeds, instead of re-listing PinnedRun's fields a second time at
// the call site.
export function toPinnedRun(candidate: CompareCandidate): PinnedRun {
  return {
    runId: candidate.runId,
    benchmark: candidate.benchmark,
    comparisonHash: candidate.comparisonHash,
    modelName: candidate.modelName,
    samplingProfileLabel: candidate.samplingProfileLabel,
    samplingProfileHash: candidate.samplingProfileHash,
    scoreFraction: candidate.scoreFraction,
  }
}

// The tray's own rules, checked in the order a person would need them
// explained: is it already pinned, is it actually finished, does it
// match what's already in the tray, is there room. AddToCompareButton
// renders whichever one of these comes back first as its disabled
// reason (via pinRefusalReason); CompareTrayProvider.pinRun calls this
// same function to refuse the mutation itself, so the button's reason
// and the actual rule can never drift apart.
export function findPinRefusal(pinnedRuns: PinnedRun[], candidate: CompareCandidate): PinRefusal | null {
  const alreadyPinned = pinnedRuns.some((run) => run.runId === candidate.runId)
  if (alreadyPinned) {
    return 'already-pinned'
  }
  if (candidate.status !== 'done') {
    return 'not-finished'
  }
  if (pinnedRuns.length > 0 && pinnedRuns[0].benchmark !== candidate.benchmark) {
    return 'other-benchmark'
  }
  if (pinnedRuns.length >= MAX_COMPARE_RUNS) {
    return 'limit-reached'
  }
  return null
}

// The plain-language text for each refusal (§8.5, item 4's own
// wording). `trayBenchmarkName` is a display name the caller already
// resolved (e.g. via benchmarkDisplayName) -- this function stays a
// pure string builder with no catalog lookup of its own, the same
// division of labour setupLabel.ts uses.
export function pinRefusalReason(refusal: PinRefusal, trayBenchmarkName: string): string {
  switch (refusal) {
    case 'already-pinned':
      return 'Already in compare'
    case 'not-finished':
      return 'Only finished runs can be compared'
    case 'other-benchmark':
      return `Compare needs the same benchmark. You are comparing ${trayBenchmarkName}.`
    case 'limit-reached':
      return `Compare limit reached (${MAX_COMPARE_RUNS} runs)`
  }
}

// Rebuilds the tray from the server's own current `done` list --
// called once when a tray restored from sessionStorage might be stale
// (a run cancelled after being pinned, a database reset during
// development). Each surviving run is re-read from `doneRuns` rather
// than trusted as-is, so a value that changed since the pin (e.g. a
// relabelled sampling profile) shows current; findPinRefusal is
// re-applied in the original pinning order so the tray's own rules
// (one benchmark, no duplicates, the run limit) still hold after
// dropping whatever no longer qualifies.
export function revalidatePinnedRuns(pinnedRuns: PinnedRun[], doneRuns: RunListItem[]): PinnedRun[] {
  const doneRunById = new Map(doneRuns.map((run) => [run.id, run]))
  const revalidated: PinnedRun[] = []
  for (const pinnedRun of pinnedRuns) {
    const doneRun = doneRunById.get(pinnedRun.runId)
    if (doneRun === undefined) {
      continue
    }
    const candidate = compareCandidateFromRun(doneRun)
    if (findPinRefusal(revalidated, candidate) !== null) {
      continue
    }
    revalidated.push(toPinnedRun(candidate))
  }
  return revalidated
}

// 'same' / 'different' drives the tray's own setup-match badge; `null`
// below two runs means there is nothing yet to compare setups between.
export function setupMatch(pinnedRuns: PinnedRun[]): SetupMatch {
  if (pinnedRuns.length < 2) {
    return null
  }
  const baselineHash = pinnedRuns[0].comparisonHash
  const allMatch = pinnedRuns.every((run) => run.comparisonHash === baselineHash)
  return allMatch ? 'same' : 'different'
}
