import type { UseQueryResult } from '@tanstack/react-query'
import type { RunDiagnostics, RunPerformanceSummary } from '../../api/client'
import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'
import { TERM_HINTS } from '../../utils/labels'
import { KeyValueList } from '../KeyValueList/KeyValueList'
import { Skeleton } from '../Skeleton/Skeleton'
import { TermLabel } from '../TermLabel/TermLabel'
import { healthCountRows, latencyRows, throughputRows, tokenRows } from './RunHealthDetails.helper'

interface RunHealthDetailsProps {
  truncationRate: number | null
  performance: RunPerformanceSummary
  diagnostics: UseQueryResult<RunDiagnostics>
}

// The Overview tab's own health details (docs/UI_REDESIGN_PLAN.md §8.7,
// item 3): truncation, empty answers, errored requests, latency
// percentiles, tokens and throughput, as one KeyValueList -- the fuller
// counterpart to RunHealthChips' glanceable ok/warn pills in the verdict
// band above. Truncation and the performance figures come straight off
// the run itself; empty answers and errored requests need the
// diagnostics file, so those two rows show a skeleton while it loads
// rather than blocking the rest of the list.
export function RunHealthDetails({ truncationRate, performance, diagnostics }: RunHealthDetailsProps) {
  const health = diagnostics.data?.summary.health ?? null

  return (
    <div className="space-y-3">
      <KeyValueList
        rows={[
          {
            label: <TermLabel hint={TERM_HINTS.truncated}>Truncated</TermLabel>,
            value: formatFractionAsPercent(truncationRate),
          },
          ...healthCountRows(health),
          ...latencyRows(performance.latency_seconds),
          ...tokenRows(performance.output_tokens),
          ...throughputRows(performance.throughput),
        ]}
      />
      {diagnostics.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-40" />
        </div>
      )}
    </div>
  )
}
