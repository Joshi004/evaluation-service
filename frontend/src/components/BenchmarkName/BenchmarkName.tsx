import { useStandards } from '../../api/queries/standards'
import { Badge } from '../Badge/Badge'
import { benchmarkDisplayName, benchmarkVersion } from '../../utils/benchmarkDisplayName'
import { cn } from '../../utils/cn'

interface BenchmarkNameProps {
  benchmark: string
  // The specific standard row a run used, e.g. "ifeval/v1" -- optional:
  // a plain benchmark listing with no run behind it yet has none.
  standardLabel?: string | null
  className?: string
}

// The one place a benchmark's slug ("ifeval") becomes its catalog
// display name ("IFEval") -- every screen that names a benchmark
// (Leaderboard, Runs, Compare, Models) renders through this instead of
// showing the raw slug or fetching /standards itself. The version
// badge only appears when the caller has a specific standard's label
// to read it from.
export function BenchmarkName({ benchmark, standardLabel, className }: BenchmarkNameProps) {
  const standards = useStandards()
  const displayName = benchmarkDisplayName(benchmark, standards.data ?? [])
  const version = standardLabel === undefined ? null : benchmarkVersion(standardLabel)

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span>{displayName}</span>
      {version && <Badge tone="neutral">{version}</Badge>}
    </span>
  )
}
