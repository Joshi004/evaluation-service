// Shared wherever code branches on "is this run still going" --
// RunsPage's own cancellable check and useRuns' polling-interval
// decision both need the same answer, computed one way.
const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['queued', 'running'])

export function isActiveRunStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status)
}

// The sidebar's own Runs badge and the Runs page's own Active status
// chip both need "how many of these runs are still going" -- one
// count, so the two can never disagree.
export function countActiveRuns(runs: { status: string }[]): number {
  return runs.filter((run) => isActiveRunStatus(run.status)).length
}

// The Runs page's own status chips. These same five counts also cover
// a different run list -- one model's runs, with no other filters to
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
