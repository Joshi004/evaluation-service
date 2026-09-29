import type { RunListItem } from '../../api/client'
import { cn } from '../../utils/cn'
import { batchProgressSummary, buildBatchProgressSegments, countFinishedRuns } from './BatchProgressBar.helper'

interface BatchProgressBarProps {
  runs: Pick<RunListItem, 'status'>[]
  className?: string
}

// The batch header's own stacked progress bar (docs/UI_REDESIGN_PLAN.md
// §8.9, item 2) -- one segment per status present, proportional to how
// many runs hold it. `aria-valuetext` and the visible caption both
// spell out "N of M runs finished" in words, so colour is never the
// only signal (§4.5).
export function BatchProgressBar({ runs, className }: BatchProgressBarProps) {
  const total = runs.length
  if (total === 0) {
    return null
  }

  const segments = buildBatchProgressSegments(runs)
  const summary = batchProgressSummary(runs)

  return (
    <div className={cn('space-y-1', className)}>
      <div
        role="progressbar"
        aria-valuenow={countFinishedRuns(runs)}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={summary}
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        {segments.map((segment) => (
          <span
            key={segment.status}
            className={segment.toneClassName}
            style={{ width: `${(segment.count / total) * 100}%` }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{summary}</p>
    </div>
  )
}
