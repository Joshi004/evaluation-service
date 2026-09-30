import type { UseQueryResult } from '@tanstack/react-query'
import type { RunDetail, RunDiagnostics } from '../../api/client'
import { Card } from '../Card/Card'
import { RunHealthChips } from '../RunHealthChips/RunHealthChips'
import { RunStandingLines } from '../RunStandingLines/RunStandingLines'
import { buildCostText, buildHeadline } from './RunVerdictBand.helper'

interface RunVerdictBandProps {
  run: RunDetail
  diagnostics: UseQueryResult<RunDiagnostics>
}

// The run report's own verdict: score first, then how it stands
// against peers and history, then health at a glance. RunReportPage
// only renders this for a `done` run -- an in-flight, failed or
// cancelled run has no `performance` block to summarise yet, and gets
// its own state-aware panel instead (RunOverviewTab).
export function RunVerdictBand({ run, diagnostics }: RunVerdictBandProps) {
  const performance = run.performance
  if (performance === null) {
    return null
  }

  const headline = buildHeadline(performance)
  const costText = buildCostText(performance.output_tokens, performance.throughput)

  return (
    <Card>
      {headline && (
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {headline.metricValueText}
              {headline.confidenceIntervalText && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {headline.confidenceIntervalText}
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">{headline.metricLabel}</p>
          </div>

          <div>
            {headline.countsText && <p className="text-sm text-foreground">{headline.countsText}</p>}
            {headline.failedText && <p className="text-sm text-warning">{headline.failedText}</p>}
            <div className="mt-1">
              <RunStandingLines run={run} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-3">
        <RunHealthChips run={run} diagnostics={diagnostics} />
        {costText !== null && <p className="text-xs text-muted-foreground">{costText}</p>}
      </div>
    </Card>
  )
}
