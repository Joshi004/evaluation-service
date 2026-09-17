// Non-DOM logic for ComparisonBucketTable.tsx: the per-row delta text.
// Kept out of the component body per
// .cursor/rules/frontend-components.mdc.

// "+8.3pt" / "-3.1pt" / "—" -- `null` only when a bucket exists on one
// side but not the other (backend's ComparisonBucketDelta docstring),
// so there is nothing to subtract.
export function bucketDeltaText(passRateDelta: number | null): string {
  if (passRateDelta === null) {
    return '\u2014'
  }
  const points = passRateDelta * 100
  const sign = points > 0 ? '+' : ''
  return `${sign}${points.toFixed(1)}pt`
}
