// A run's status, shared wherever code branches on it -- RunsPage's own
// cancellable check and useRuns' polling-interval decision both need
// "is this run still going", so it's computed the same way in both
// places instead of each keeping its own status set.
export type RunStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['queued', 'running'])

export function isActiveRunStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status)
}

// The sidebar's own Runs badge (docs/UI_REDESIGN_PLAN.md §8.9, Appendix
// A: "sidebar Runs badge shows the active count") and the Runs page's
// own Active status chip both need "how many of these runs are still
// going" -- one count, so the two can never disagree.
export function countActiveRuns(runs: { status: string }[]): number {
  return runs.filter((run) => isActiveRunStatus(run.status)).length
}

// The Runs page's own status chips (§8.9). Lifted here from
// RunsPage.helper.ts (Phase 11, §8.11) once a model's own Runs tab
// became a second caller that needs the same five counts for a
// different run list -- one model's runs, with no other filters to
// combine with -- not just RunsPage's own filtered-by-everything-else
// list.
export const RUNS_STATUS_FILTER_VALUES = ['active', 'done', 'failed', 'cancelled', 'all'] as const
export type RunsStatusFilter = (typeof RUNS_STATUS_FILTER_VALUES)[number]

export function matchesRunsStatusFilter(run: { status: string }, filter: RunsStatusFilter): boolean {
  if (filter === 'all') {
    return true
  }
  if (filter === 'active') {
    return isActiveRunStatus(run.status)
  }
  return run.status === filter
}

export interface RunsStatusCounts {
  active: number
  done: number
  failed: number
  cancelled: number
  all: number
}

export function countRunsByStatus(runs: { status: string }[]): RunsStatusCounts {
  return {
    active: runs.filter((run) => isActiveRunStatus(run.status)).length,
    done: runs.filter((run) => run.status === 'done').length,
    failed: runs.filter((run) => run.status === 'failed').length,
    cancelled: runs.filter((run) => run.status === 'cancelled').length,
    all: runs.length,
  }
}
