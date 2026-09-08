import type { Benchmark, Checkpoint, EvalRun, Modality, Team } from '../data/types'

export interface LeaderboardFilters {
  team: Team | 'all'
  modality: Modality | 'all'
  standardOnly: boolean
}

export const TEAM_OPTIONS: Team[] = ['tool-call', 'one-bit-models', 'vlm-eval', 'medpsy']
export const MODALITY_OPTIONS: Modality[] = ['text', 'vision', 'medical', 'tool-use']

// Which run represents a (checkpoint, benchmark) cell. The standard,
// published run always wins when one exists — a cell shows the current
// authoritative number, not whichever run happened to finish last. With
// "standard only" off, a pair that has nothing else still shows its most
// recent exploratory run rather than nothing.
export function pickDisplayRun(
  checkpointId: string,
  benchmarkId: string,
  runs: readonly EvalRun[],
  standardOnly: boolean,
): EvalRun | null {
  const candidates = runs.filter(
    (run) => run.checkpointId === checkpointId && run.benchmarkId === benchmarkId && run.phase === 'completed',
  )
  const standardPublished = candidates.find((run) => run.isStandard && run.published)
  if (standardOnly) return standardPublished ?? null
  if (standardPublished) return standardPublished

  return (
    candidates.slice().sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime())[0] ?? null
  )
}

// Only checkpoints with at least one visible cell become a row — an
// all-dash row is noise, not information.
export function filterCheckpointsForLeaderboard(
  checkpoints: readonly Checkpoint[],
  benchmarks: readonly Benchmark[],
  runs: readonly EvalRun[],
  filters: LeaderboardFilters,
): Checkpoint[] {
  return checkpoints.filter((checkpoint) => {
    if (filters.team !== 'all' && checkpoint.team !== filters.team) return false
    if (filters.modality !== 'all' && checkpoint.modality !== filters.modality) return false
    return benchmarks.some((benchmark) => pickDisplayRun(checkpoint.id, benchmark.id, runs, filters.standardOnly) !== null)
  })
}
