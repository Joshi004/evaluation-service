import { Link } from 'react-router'
import type { StandardSummary } from '../../api/client'
import type { BenchmarkCardStats } from '../../pages/BenchmarksPage.helper'
import { benchmarkVersion } from '../../utils/benchmarkDisplayName'
import { paths } from '../../utils/paths'
import { protocolSummary } from '../../utils/protocolSummary'
import { Badge } from '../Badge/Badge'
import { Card } from '../Card/Card'
import { RelativeTime } from '../RelativeTime/RelativeTime'

interface BenchmarkCardProps {
  standard: StandardSummary
  // `undefined` for a benchmark with no results yet --
  // buildBenchmarkCardStatsByStandardId only has an entry for a
  // standard_id at least one leaderboard row names.
  stats: BenchmarkCardStats | undefined
}

// One benchmark's own card on the Benchmarks list (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12): the whole card links to its detail
// page -- unlike ModelCard, this card has exactly one destination, so
// there's no second action competing for the click the way a model's
// own "Compare with…" button does.
export function BenchmarkCard({ standard, stats }: BenchmarkCardProps) {
  const version = benchmarkVersion(standard.label)
  const primaryMetric = standard.metrics.find((metric) => metric.is_primary)

  return (
    <Link to={paths.benchmark(standard.id)} className="block">
      <Card className="h-full space-y-2 hover:border-border-strong">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{standard.display_name ?? standard.benchmark}</span>
          {version && <Badge tone="neutral">{version}</Badge>}
        </div>
        {standard.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{standard.description}</p>
        )}
        {primaryMetric && (
          <p className="text-xs text-subtle-foreground">Headline score: {primaryMetric.display_name}</p>
        )}
        <p className="text-xs text-subtle-foreground">{protocolSummary(standard, stats?.scoredSampleCount)}</p>
        <p className="text-xs text-muted-foreground">
          {stats === undefined ? (
            'Not evaluated yet'
          ) : (
            <>
              {stats.modelsEvaluatedCount} model{stats.modelsEvaluatedCount === 1 ? '' : 's'} evaluated · last{' '}
              <RelativeTime timestamp={stats.lastEvaluatedAt} />
            </>
          )}
        </p>
      </Card>
    </Link>
  )
}
