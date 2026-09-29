import type { ConfidenceInterval } from '../api/client'

// Whether two 95% confidence intervals overlap -- the leaderboard's ★
// ("leads or is within margin of error") and a run report's "within
// margin of #N" line both derive from this one check, so a score
// difference smaller than the noise never reads as a real difference
// in one place and a tie in another.
export function intervalsOverlap(a: ConfidenceInterval, b: ConfidenceInterval): boolean {
  return a.lower <= b.upper && b.lower <= a.upper
}
