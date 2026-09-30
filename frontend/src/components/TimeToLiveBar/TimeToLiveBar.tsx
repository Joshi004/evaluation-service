import { cn } from '../../utils/cn'
import { computeTimeToLive } from './TimeToLiveBar.helper'

interface TimeToLiveBarProps {
  createdAt: string
  expiresAt: string
  // Passed in, not read internally -- the caller drives this from its
  // own ticker (ModelServerCard's useNow) so several cards on one page
  // share a single interval instead of each starting its own.
  now: Date
  className?: string
}

// A model server card's own "how much longer does this have" meter
// (docs/UI_REDESIGN_PLAN.md §8.13, item 1's "time-to-live bar from
// created_at/expires_at"): full right after a start, empty as
// `expires_at` approaches. The caption always spells out the same
// meaning in words (§4.5: never colour alone), and stands in for the
// bar entirely when the dates can't be parsed.
export function TimeToLiveBar({ createdAt, expiresAt, now, className }: TimeToLiveBarProps) {
  const { fractionLeft, label, endingSoon } = computeTimeToLive(createdAt, expiresAt, now)

  return (
    <div className={cn('space-y-1', className)}>
      {fractionLeft !== null && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(fractionLeft * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={label}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <span
            className={cn('block h-full rounded-full', endingSoon ? 'bg-warning' : 'bg-info')}
            style={{ width: `${fractionLeft * 100}%` }}
          />
        </div>
      )}
      <p className={cn('text-xs', endingSoon ? 'text-warning' : 'text-muted-foreground')}>{label}</p>
    </div>
  )
}
