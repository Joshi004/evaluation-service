import { Link } from 'react-router'
import { DENSITY_CELL_PADDING, type ResolvedLeaderboardView } from '../../pages/LeaderboardPage.helper'
import { benchmarkVersion } from '../../utils/benchmarkDisplayName'
import { buildRankedRows, type BenchmarkColumn, type ModelRow, type RankedRow } from '../../utils/buildLeaderboard'
import { cn } from '../../utils/cn'
import { compareCandidateFromLeaderboardCell } from '../../utils/compareTray'
import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'
import { computeIntervalDomain } from '../../utils/intervalDomain'
import { TERM_HINTS } from '../../utils/labels'
import { paths } from '../../utils/paths'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'
import { AddToCompareButton } from '../AddToCompareButton/AddToCompareButton'
import { Badge } from '../Badge/Badge'
import { EmptyState } from '../EmptyState/EmptyState'
import { IntervalWhisker } from '../IntervalWhisker/IntervalWhisker'
import { LeaderboardNotEvaluatedList } from '../LeaderboardNotEvaluatedList/LeaderboardNotEvaluatedList'
import { ModelName } from '../ModelName/ModelName'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SelectField } from '../SelectField/SelectField'
import { SetupChip } from '../SetupChip/SetupChip'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { TermLabel } from '../TermLabel/TermLabel'
import { Tooltip } from '../Tooltip/Tooltip'
import { buildNotEvaluatedModels } from './LeaderboardBenchmarkTable.helper'

interface LeaderboardBenchmarkTableProps {
  // Unfiltered, for the Benchmark selector -- this lens ignores the
  // Overview-only Benchmarks filter.
  allColumns: BenchmarkColumn[]
  // Already filtered by search and Family.
  filteredModels: ModelRow[]
  view: ResolvedLeaderboardView
  onBenchmarkChange: (benchmark: string) => void
}

// A ranked board for exactly one benchmark: each model's best result,
// with the setup it came from -- the depth complement to Overview's
// breadth. `view.sortColumn` is the benchmark on display; the same URL
// field Overview uses to pick its sorted column, so switching lenses
// keeps the same benchmark in focus.
export function LeaderboardBenchmarkTable({
  allColumns,
  filteredModels,
  view,
  onBenchmarkChange,
}: LeaderboardBenchmarkTableProps) {
  const column = view.sortColumn

  if (!column) {
    return (
      <EmptyState
        title="No benchmarks yet"
        description="Register a model, then run an evaluation to see ranked results here."
      />
    )
  }

  const rankedRows = buildRankedRows(column.bestResultsByCheckpointId, filteredModels)
  const notEvaluatedModels = buildNotEvaluatedModels(column, filteredModels)
  const domain = computeIntervalDomain(rankedRows.map((row) => row.cell))
  // `column.setups` is never empty (see buildLeaderboard.ts); its first
  // entry is the benchmark's default setup (most models, ties -> most
  // recent), the one a "Run it" link should evaluate against.
  const runItStandardId = column.setups[0].standardId

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SelectField
          className="w-56"
          value={column.benchmark}
          onValueChange={onBenchmarkChange}
          groups={[
            { options: allColumns.map((candidate) => ({ value: candidate.benchmark, label: candidate.displayName })) },
          ]}
          aria-label="Benchmark"
        />
      </div>

      {rankedRows.length === 0 ? (
        <EmptyState title="No results on this benchmark yet" description="Run an evaluation to see ranked results here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>Rank</TableHeaderCell>
              <TableHeaderCell>Model</TableHeaderCell>
              <TableHeaderCell className="text-right">
                <TermLabel hint={TERM_HINTS.headlineScore}>Score</TermLabel>
              </TableHeaderCell>
              <TableHeaderCell>
                <TermLabel hint={TERM_HINTS.marginOfError}>95% margin of error</TermLabel>
              </TableHeaderCell>
              <TableHeaderCell className="text-right">
                <TermLabel hint={TERM_HINTS.samples}>Samples</TermLabel>
              </TableHeaderCell>
              <TableHeaderCell className="text-right">
                <TermLabel hint={TERM_HINTS.truncated}>Truncated</TermLabel>
              </TableHeaderCell>
              <TableHeaderCell>
                <TermLabel hint={TERM_HINTS.setup}>Setup</TermLabel>
              </TableHeaderCell>
              <TableHeaderCell>Serving profile</TableHeaderCell>
              <TableHeaderCell>Evaluated</TableHeaderCell>
              <TableHeaderCell />
            </tr>
          </thead>
          <tbody>
            {rankedRows.map((row) => (
              <LeaderboardBenchmarkRow
                key={row.model.checkpointId}
                column={column}
                row={row}
                domain={domain}
                density={view.density}
              />
            ))}
          </tbody>
        </Table>
      )}

      <LeaderboardNotEvaluatedList standardId={runItStandardId} models={notEvaluatedModels} />
    </div>
  )
}

interface LeaderboardBenchmarkRowProps {
  column: BenchmarkColumn
  row: RankedRow
  domain: { min: number; max: number }
  density: ResolvedLeaderboardView['density']
}

function LeaderboardBenchmarkRow({ column, row, domain, density }: LeaderboardBenchmarkRowProps) {
  const { model, setup, cell } = row
  const padding = DENSITY_CELL_PADDING[density]

  return (
    <tr>
      <TableCell className={cn('tabular-nums', padding)}>
        {cell.rank}
        {cell.withinLeaderMargin && (
          <Tooltip content="Within the leader's margin of error (the intervals overlap)">
            <span tabIndex={0} className="ml-1 text-muted-foreground">
              ≈
            </span>
          </Tooltip>
        )}
      </TableCell>
      <TableCell className={padding}>
        <ModelName name={model.name} family={model.family} to={paths.model(model.checkpointId)} />
      </TableCell>
      <TableCell className={cn('text-right', padding)}>
        <ScoreValue value={cell.value} />
      </TableCell>
      <TableCell className={padding}>
        {cell.confidenceInterval && (
          <IntervalWhisker
            lower={cell.confidenceInterval.lower}
            upper={cell.confidenceInterval.upper}
            value={cell.value}
            domainMin={domain.min}
            domainMax={domain.max}
            className={cell.isLeader ? 'text-foreground' : 'text-muted-foreground'}
          />
        )}
      </TableCell>
      <TableCell className={cn('text-right tabular-nums', padding)}>{cell.nSamples ?? '—'}</TableCell>
      <TableCell className={cn('text-right tabular-nums', padding)}>{formatFractionAsPercent(cell.truncationRate)}</TableCell>
      <TableCell className={padding}>
        <div className="flex items-center gap-1.5">
          <SetupChip samplingProfileLabel={setup.samplingProfileLabel} samplingProfileHash={setup.samplingProfileHash} />
          {column.hasMultipleStandardVersions && (
            <Badge tone="neutral">{benchmarkVersion(setup.standardLabel) ?? 'custom'}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className={padding}>{servingProfileDisplayName(cell.servingProfileLabel, cell.servingProfileHash)}</TableCell>
      <TableCell className={padding}>
        <RelativeTime timestamp={cell.finishedAt} />
      </TableCell>
      <TableCell className={cn('text-right', padding)}>
        <div className="flex items-center justify-end gap-2">
          <AddToCompareButton
            candidate={compareCandidateFromLeaderboardCell({
              runId: cell.evalRunId,
              benchmark: column.benchmark,
              comparisonHash: setup.comparisonHash,
              modelName: model.name,
              samplingProfileLabel: setup.samplingProfileLabel,
              samplingProfileHash: setup.samplingProfileHash,
              scoreFraction: cell.value,
            })}
          />
          <Link to={paths.run(cell.evalRunId)} className="text-xs font-medium text-primary hover:underline">
            Open run
          </Link>
        </div>
      </TableCell>
    </tr>
  )
}
