// Formats a stored 0..1 fraction as a percentage with one decimal place.
// Shared by RunsPage (truncation_rate) and RunDetailPage (both
// truncation_rate and every metric value) -- per docs/DATA_MODEL_V1.md's
// ground rules, "fractions are 0..1" for both columns, so one formatter
// covers both instead of two pages rounding the same number differently.
export function formatFractionAsPercent(fraction: number | null): string {
  return fraction === null ? '—' : `${(fraction * 100).toFixed(1)}%`
}
