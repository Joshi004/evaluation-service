import { Activity, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useRuns } from '../../api/queries/runs'
import { paths } from '../../utils/paths'
import { describeRecentActivity, summarizeRecentActivity } from './LeaderboardActivityStrip.helper'

// §8.6 item 7: a slim link to Runs, shown only when there is something
// worth interrupting the front door for -- silent otherwise, so a
// quiet catalog stays quiet.
export function LeaderboardActivityStrip() {
  const runs = useRuns()
  if (!runs.data) {
    return null
  }

  const summary = summarizeRecentActivity(runs.data, new Date())
  if (summary.activeCount === 0 && summary.recentFailedCount === 0) {
    return null
  }

  return (
    <Link
      to={paths.runs()}
      className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground hover:border-border-strong"
    >
      <Activity className="h-4 w-4 text-info" aria-hidden="true" />
      {describeRecentActivity(summary)}
      <span className="ml-auto flex items-center gap-1 text-xs font-medium text-primary">
        View runs
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </span>
    </Link>
  )
}
