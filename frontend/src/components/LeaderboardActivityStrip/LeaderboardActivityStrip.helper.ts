import type { RunListItem } from '../../api/client'
import { isActiveRunStatus } from '../../utils/runStatus'

const DAY_MS = 24 * 60 * 60 * 1000

export interface RecentActivitySummary {
  activeCount: number
  recentFailedCount: number
}

// What the strip decides to show: anything still queued/running right
// now, or anything that failed within the last day -- older failures
// are Runs' own job to surface, not something that should linger on
// the front door indefinitely.
export function summarizeRecentActivity(runs: RunListItem[], now: Date): RecentActivitySummary {
  let activeCount = 0
  let recentFailedCount = 0
  for (const run of runs) {
    if (isActiveRunStatus(run.status)) {
      activeCount += 1
      continue
    }
    if (run.status === 'failed' && run.finished_at !== null && now.getTime() - new Date(run.finished_at).getTime() < DAY_MS) {
      recentFailedCount += 1
    }
  }
  return { activeCount, recentFailedCount }
}

export function describeRecentActivity(summary: RecentActivitySummary): string {
  const parts: string[] = []
  if (summary.activeCount > 0) {
    parts.push(`${summary.activeCount} run${summary.activeCount === 1 ? '' : 's'} active`)
  }
  if (summary.recentFailedCount > 0) {
    parts.push(`${summary.recentFailedCount} failed in the last 24 h`)
  }
  return parts.join(' \u00b7 ')
}
