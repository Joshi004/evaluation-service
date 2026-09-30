import type { RunDetail } from '../../api/client'
import type { ComparePairState } from '../../utils/compareRuns'
import { cn } from '../../utils/cn'
import { seriesBgClassName, seriesTextClassName } from '../../utils/compareSeriesColor'
import { formatScore, formatScoreDelta, formatScoreWithUnit } from '../../utils/formatScore'
import { computeIntervalDomain } from '../../utils/intervalDomain'
import { TERM_HINTS } from '../../utils/labels'
import { Badge } from '../Badge/Badge'
import { Callout } from '../Callout/Callout'
import { IntervalWhisker } from '../IntervalWhisker/IntervalWhisker'
import { ModelName } from '../ModelName/ModelName'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SetupChip } from '../SetupChip/SetupChip'
import { Skeleton } from '../Skeleton/Skeleton'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { TermLabel } from '../TermLabel/TermLabel'
import { Tooltip } from '../Tooltip/Tooltip'
import { buildRefusalNotes, primaryMetric } from './CompareScoreMatrix.helper'

interface CompareScoreMatrixProps {
  baseline: RunDetail
  pairs: ComparePairState[]
}

// Wider than the Leaderboard's own row-height whisker (default 96px)
// so 2-4 overlapping intervals stay legible on one shared axis -- what
// a forest plot needs.
const WHISKER_WIDTH = 240

// Score, forest-plot whisker and Δ-vs-baseline, one row per run.
// Score, interval, samples and pass/fail come straight from
// each run's own GET /runs/{id} (already loaded by ComparisonView),
// so every row renders before any pairwise comparison finishes; only
// the Δ and significance columns wait on that second request.
export function CompareScoreMatrix({ baseline, pairs }: CompareScoreMatrixProps) {
  const allRuns = [baseline, ...pairs.map((pair) => pair.run)]
  const domain = computeIntervalDomain(
    allRuns.map((run) => {
      const metric = primaryMetric(run)
      return { value: metric?.value ?? 0, confidenceInterval: metric?.confidence_interval ?? null }
    }),
  )
  const refusalNotes = buildRefusalNotes(pairs)

  return (
    <div className="space-y-3">
      <Table>
        <thead>
          <tr>
            <TableHeaderCell>Run</TableHeaderCell>
            <TableHeaderCell>Model</TableHeaderCell>
            <TableHeaderCell>
              <TermLabel hint={TERM_HINTS.setup}>Setup</TermLabel>
            </TableHeaderCell>
            <TableHeaderCell className="text-right">
              <TermLabel hint={TERM_HINTS.headlineScore}>Score</TermLabel>
            </TableHeaderCell>
            <TableHeaderCell>
              <div className="flex justify-between text-xs font-normal text-muted-foreground">
                <span>{formatScoreWithUnit(domain.min)}</span>
                <span>{formatScoreWithUnit(domain.max)}</span>
              </div>
            </TableHeaderCell>
            <TableHeaderCell className="text-right">Δ vs baseline</TableHeaderCell>
            <TableHeaderCell className="text-right">Passed</TableHeaderCell>
            <TableHeaderCell className="text-right">Failed</TableHeaderCell>
          </tr>
        </thead>
        <tbody>
          <CompareScoreRow run={baseline} index={0} domain={domain} isBaseline />
          {pairs.map((pair, index) => (
            <CompareScoreRow key={pair.run.id} run={pair.run} index={index + 1} domain={domain} pair={pair} />
          ))}
        </tbody>
      </Table>

      {refusalNotes.map((note) => (
        <Callout key={note.runId} tone="info">
          Run #{note.runId}: {note.reason} ({note.overlapText})
        </Callout>
      ))}
    </div>
  )
}

interface CompareScoreRowProps {
  run: RunDetail
  index: number
  domain: { min: number; max: number }
  isBaseline?: boolean
  pair?: ComparePairState
}

// Not exported -- CompareScoreMatrix renders one per run; nothing else
// needs a single row on its own.
function CompareScoreRow({ run, index, domain, isBaseline = false, pair }: CompareScoreRowProps) {
  const metric = primaryMetric(run)
  const textColorClassName = seriesTextClassName(index)

  return (
    <tr>
      <TableCell>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', seriesBgClassName(index))} aria-hidden="true" />#{run.id}
        </span>
        {isBaseline && (
          <Badge tone="info" className="ml-1.5">
            Baseline
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <ModelName name={run.checkpoint_name} />
      </TableCell>
      <TableCell>
        <SetupChip samplingProfileLabel={run.sampling_profile_label} samplingProfileHash={run.sampling_profile_hash} />
      </TableCell>
      <TableCell className="text-right">
        <ScoreValue
          value={metric?.value ?? null}
          interval={metric?.confidence_interval ?? null}
          display={metric?.display ?? null}
        />
      </TableCell>
      <TableCell>
        {metric?.confidence_interval && (
          <IntervalWhisker
            lower={metric.confidence_interval.lower}
            upper={metric.confidence_interval.upper}
            value={metric.value}
            domainMin={domain.min}
            domainMax={domain.max}
            width={WHISKER_WIDTH}
            className={textColorClassName}
          />
        )}
      </TableCell>
      <TableCell className="text-right">
        <CompareDeltaCell isBaseline={isBaseline} pair={pair} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{metric?.passed ?? '—'}</TableCell>
      <TableCell className="text-right tabular-nums">{metric?.failed ?? '—'}</TableCell>
    </tr>
  )
}

interface CompareDeltaCellProps {
  isBaseline: boolean
  pair?: ComparePairState
}

// Not exported -- one cell's worth of "how does this run compare to
// the baseline", covering every state the pairwise request can be in.
function CompareDeltaCell({ isBaseline, pair }: CompareDeltaCellProps) {
  if (isBaseline || !pair) {
    return <span className="text-muted-foreground">—</span>
  }
  if (pair.status === 'loading') {
    return <Skeleton className="ml-auto h-4 w-16" />
  }
  if (pair.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-danger">
        Could not compare
        <button type="button" onClick={pair.refetch} className="font-medium text-danger hover:underline">
          Retry
        </button>
      </span>
    )
  }
  const comparison = pair.comparison
  if (!comparison || !comparison.comparable || !comparison.delta) {
    return <span className="text-xs text-muted-foreground">Not comparable</span>
  }
  const { delta } = comparison
  const combinedMargin = formatScore(delta.combined_half_width)
  return (
    <Tooltip
      content={
        delta.is_significant
          ? `Significant — outside the combined ±${combinedMargin}pt interval`
          : `Not significant — inside the combined ±${combinedMargin}pt interval`
      }
    >
      <span
        tabIndex={0}
        className={cn('tabular-nums', delta.is_significant ? 'text-foreground' : 'text-muted-foreground')}
      >
        {formatScoreDelta(delta.value)}
      </span>
    </Tooltip>
  )
}
