import type { ConfidenceInterval, MetricDisplay } from '../../api/client'
import { formatMargin, formatScore, formatScoreWithUnit } from '../../utils/formatScore'
import { cn } from '../../utils/cn'

interface ScoreValueProps {
  value: number | null
  interval?: ConfidenceInterval | null
  samples?: number | null
  display?: MetricDisplay | null
  showUnit?: boolean
  className?: string
}

// One score, formatted one way everywhere it appears (§4.5's
// "Numbers" pattern): percent with one decimal by default, or the
// metric's own display hint when the run carries one. Uncertainty is
// part of the number (§3 rule 4) -- the margin of error renders
// alongside the score whenever `interval` is given, not as a separate
// lookup a caller has to remember to add.
export function ScoreValue({
  value,
  interval = null,
  samples,
  display = null,
  showUnit = true,
  className,
}: ScoreValueProps) {
  if (value === null) {
    return <span className={cn('tabular-nums text-muted-foreground', className)}>—</span>
  }

  const scoreText = showUnit ? formatScoreWithUnit(value, display) : formatScore(value, display)
  const margin = formatMargin(interval, display)

  return (
    <span className={cn('tabular-nums', className)}>
      {scoreText}
      {margin && (
        <span className="ml-1 text-xs text-muted-foreground">
          {margin}
          <span className="sr-only"> margin of error</span>
        </span>
      )}
      {samples !== null && samples !== undefined && (
        <span className="ml-1 text-xs text-muted-foreground">
          {samples} sample{samples === 1 ? '' : 's'}
        </span>
      )}
    </span>
  )
}
