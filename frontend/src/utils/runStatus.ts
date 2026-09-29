// A run's status, shared wherever code branches on it -- RunsPage's own
// cancellable check and useRuns' polling-interval decision both need
// "is this run still going", so it's computed the same way in both
// places instead of each keeping its own status set.
export type RunStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['queued', 'running'])

export function isActiveRunStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status)
}
