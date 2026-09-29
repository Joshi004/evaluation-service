import { formatScoreWithUnit } from '../../utils/formatScore'

interface IntervalWhiskerProps {
  lower: number
  upper: number
  value: number
  // The caller's shared axis (e.g. every ranked row on one benchmark
  // board, or a mean-value clamp) -- so two whiskers drawn side by side
  // are visually comparable instead of each independently zoomed to its
  // own interval, which is what genuinely makes it a forest plot rather
  // than five unrelated line segments.
  domainMin: number
  domainMax: number
  // Defaults to 96 (the By-benchmark lens's own row-height whisker,
  // Phase 6) -- Compare's forest plot (Phase 8) asks for a wider one
  // so 2-4 rows' worth of overlapping intervals stay legible.
  width?: number
  // One complete colour utility (`text-foreground`, `text-series-2`, …)
  // -- there is no tailwind-merge in this project (see D2), so this
  // component never supplies its own default that a caller would need
  // to override.
  className?: string
}

const DEFAULT_WIDTH = 96
const HEIGHT = 16
const CAP_HALF_HEIGHT = 3

// A plain-SVG "|----o----|" for one score's 95% confidence interval --
// no chart library: both `recharts` and `@xyflow/react` stay confined
// to `prototype/` per D5, and this shape is simple enough that adding
// one back for it would be ceremony, not a payoff. Phase 8's forest
// plot draws several of these on one shared axis; the By-benchmark
// lens (Phase 6) draws one per ranked row.
export function IntervalWhisker({
  lower,
  upper,
  value,
  domainMin,
  domainMax,
  width = DEFAULT_WIDTH,
  className,
}: IntervalWhiskerProps) {
  const span = domainMax - domainMin || 1
  const toX = (fraction: number): number => ((fraction - domainMin) / span) * width
  const midY = HEIGHT / 2

  const lowerX = toX(lower)
  const upperX = toX(upper)
  const valueX = toX(value)
  const label = `${formatScoreWithUnit(value)}, interval ${formatScoreWithUnit(lower)} to ${formatScoreWithUnit(upper)}`

  return (
    <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} className={className} role="img" aria-label={label}>
      <line x1={0} y1={midY} x2={width} y2={midY} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} />
      <line x1={lowerX} y1={midY} x2={upperX} y2={midY} stroke="currentColor" strokeWidth={2} />
      <line
        x1={lowerX}
        y1={midY - CAP_HALF_HEIGHT}
        x2={lowerX}
        y2={midY + CAP_HALF_HEIGHT}
        stroke="currentColor"
        strokeWidth={2}
      />
      <line
        x1={upperX}
        y1={midY - CAP_HALF_HEIGHT}
        x2={upperX}
        y2={midY + CAP_HALF_HEIGHT}
        stroke="currentColor"
        strokeWidth={2}
      />
      <circle cx={valueX} cy={midY} r={3} fill="currentColor" />
    </svg>
  )
}
