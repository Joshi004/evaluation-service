import type { StandardSummary } from '../api/client'

// "gpqa_diamond" -> "Gpqa Diamond" -- only reached when a benchmark has
// no catalog display_name yet (a standard loaded before the Phase 3
// YAML update, until the next reload backfills it); every benchmark in
// today's catalog already has one, so this is a fallback, not the
// common path.
function prettifySlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// The catalog's own display_name for a benchmark slug ("ifeval" ->
// "IFEval"), read off whichever standard row carries it -- every
// standard sharing a benchmark carries the same display_name, so the
// first match is enough.
export function benchmarkDisplayName(benchmark: string, standards: StandardSummary[]): string {
  const standard = standards.find((candidate) => candidate.benchmark === benchmark)
  return standard?.display_name ?? prettifySlug(benchmark)
}

// "ifeval/v1" -> "v1" -- the version half of a standard's own label
// (benchmark and version joined with a slash, app/models/standard.py).
// `null` in, `null` out: an ad-hoc standard has no label to read a
// version from.
export function benchmarkVersion(standardLabel: string | null): string | null {
  if (standardLabel === null) {
    return null
  }
  const slashIndex = standardLabel.indexOf('/')
  return slashIndex === -1 ? standardLabel : standardLabel.slice(slashIndex + 1)
}
