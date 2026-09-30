// A shared axis for every whisker drawn together, padded a little past
// the widest interval so the end caps are never drawn flush against
// the SVG's own edge -- what makes a row of whiskers genuinely a
// forest plot (every row directly comparable) rather than each row
// independently zoomed to its own interval.
import type { ConfidenceInterval } from '../api/client'

// Deliberately narrower than ScoreCellData (the Leaderboard's own
// shape) or ComparisonSide (Compare's) -- this only ever needs a
// value and its interval, so either caller can pass its own rows
// straight through with no reshaping.
export interface IntervalDomainInput {
  value: number
  confidenceInterval: ConfidenceInterval | null
}

export function computeIntervalDomain(cells: IntervalDomainInput[]): { min: number; max: number } {
  if (cells.length === 0) {
    return { min: 0, max: 1 }
  }
  const lowerBounds = cells.map((cell) => cell.confidenceInterval?.lower ?? cell.value)
  const upperBounds = cells.map((cell) => cell.confidenceInterval?.upper ?? cell.value)
  const rawMin = Math.min(...lowerBounds)
  const rawMax = Math.max(...upperBounds)
  const span = rawMax - rawMin
  const padding = span === 0 ? 0.05 : span * 0.15
  return { min: Math.max(0, rawMin - padding), max: Math.min(1, rawMax + padding) }
}
