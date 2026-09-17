import type { RunPerformanceSummary } from '../../api/client'
import { buildCostText, buildHeadline, buildHealthText } from './RunHealthBand.helper'

interface RunHealthBandProps {
  performance: RunPerformanceSummary
  truncationRate: number | null
}

// Phase 1 of docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md: turns the run's
// stored percentages into counts, a confidence interval, and cost/health
// lines -- computed entirely from data already in Postgres
// (RunDetail.performance), no file reads. `mt-6` is baked in here
// rather than at the call site: every section on RunDetailPage carries
// its own top margin the same way.
export function RunHealthBand({ performance, truncationRate }: RunHealthBandProps) {
  const headline = buildHeadline(performance)
  const costText = buildCostText(performance.output_tokens, performance.throughput)
  const healthText = buildHealthText(truncationRate, performance.latency_seconds)

  return (
    <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      {headline && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            {headline.countsText && (
              <p className="text-sm text-slate-200">{headline.countsText}</p>
            )}
            {headline.failedText && (
              <p className="text-sm text-amber-400">{headline.failedText}</p>
            )}
          </div>
          <p className="text-sm">
            <span className="text-slate-400">{headline.metricLabel}</span>{' '}
            <span className="font-mono text-slate-100">{headline.metricValueText}</span>
            {headline.confidenceIntervalText && (
              <span className="ml-2 text-xs text-slate-500">{headline.confidenceIntervalText}</span>
            )}
          </p>
        </div>
      )}

      {(costText !== null || healthText !== null) && (
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {costText !== null && (
            <div>
              <dt className="text-xs text-slate-500">Cost</dt>
              <dd className="mt-0.5 text-slate-300">{costText}</dd>
            </div>
          )}
          {healthText !== null && (
            <div>
              <dt className="text-xs text-slate-500">Health</dt>
              <dd className="mt-0.5 text-slate-300">{healthText}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}
