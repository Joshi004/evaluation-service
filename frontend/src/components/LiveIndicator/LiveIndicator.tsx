import { AlertTriangle } from 'lucide-react'
import { cn } from '../../utils/cn'
import { formatTimestamp } from '../../utils/formatTimestamp'
import { Badge } from '../Badge/Badge'
import { Tooltip } from '../Tooltip/Tooltip'

interface LiveIndicatorProps {
  // Milliseconds between automatic refreshes -- the caller reads this
  // off runsPollIntervalMs (api/queries/runs.ts) rather than this
  // component taking a whole UseQueryResult itself, so all three states
  // can be demoed on /styleguide with plain values instead of a
  // fabricated query result.
  pollIntervalMs: number
  isRefetchError: boolean
  lastCheckedAt: number | null
}

// A pulsing dot plus "Live" while polling every 5s (something in view
// is queued or running), a steady dot at the 30s baseline, and a
// warning state when a background refresh itself fails.
// `isRefetchError` (TanStack Query's own flag for "the last fetch
// failed but the data already on screen is still there") is what tells
// that apart from a first-load failure, which the page's own
// ErrorState already owns -- this indicator never replaces the loaded
// table with an error. Shared by the Runs toolbar and the model server
// list, both of which poll on their own interval.
export function LiveIndicator({ pollIntervalMs, isRefetchError, lastCheckedAt }: LiveIndicatorProps) {
  const intervalSeconds = pollIntervalMs / 1000
  const isFastPoll = intervalSeconds <= 5
  const lastChecked = lastCheckedAt === null ? null : formatTimestamp(new Date(lastCheckedAt).toISOString())

  if (isRefetchError) {
    return (
      <Tooltip
        content={`The last automatic refresh failed. Showing data from ${lastChecked ?? 'the last successful check'}.`}
      >
        <span tabIndex={0} role="status">
          <Badge tone="warning" className="gap-1">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Not updating
          </Badge>
        </span>
      </Tooltip>
    )
  }

  return (
    <Tooltip content={`Checking every ${intervalSeconds}s. Last checked ${lastChecked ?? 'just now'}.`}>
      <span tabIndex={0} role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn('h-2 w-2 rounded-full bg-info', isFastPoll && 'motion-safe:animate-pulse')}
          aria-hidden="true"
        />
        Live
      </span>
    </Tooltip>
  )
}
