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
