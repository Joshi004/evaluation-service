import { Link } from 'react-router'
import {
  DENSITY_CELL_PADDING,
  resolveSetupForBenchmark,
  type ResolvedLeaderboardView,
} from '../../pages/LeaderboardPage.helper'
import { buildRankedRows, type BenchmarkColumn, type ModelRow, type RankedRow, type SetupOption } from '../../utils/buildLeaderboard'
import { cn } from '../../utils/cn'
import { compareCandidateFromLeaderboardCell } from '../../utils/compareTray'
import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'
import { computeIntervalDomain } from '../../utils/intervalDomain'
import { paths } from '../../utils/paths'
import { samplingProfileDisplayName } from '../../utils/samplingProfileDisplayName'
import { shortFingerprint } from '../../utils/shortFingerprint'
import { AddToCompareButton } from '../AddToCompareButton/AddToCompareButton'
import { EmptyState } from '../EmptyState/EmptyState'
import { IntervalWhisker } from '../IntervalWhisker/IntervalWhisker'
import { LeaderboardNotEvaluatedList } from '../LeaderboardNotEvaluatedList/LeaderboardNotEvaluatedList'
import { ModelName } from '../ModelName/ModelName'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SelectField } from '../SelectField/SelectField'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { Tooltip } from '../Tooltip/Tooltip'
import { buildNotEvaluatedModels } from './LeaderboardBenchmarkTable.helper'

interface LeaderboardBenchmarkTableProps {
  // Unfiltered, for the Benchmark selector -- this lens ignores the
  // Overview-only Benchmarks filter (§8.6's URL contract).
  allColumns: BenchmarkColumn[]
  // Already filtered by search and Family.
  filteredModels: ModelRow[]
  view: ResolvedLeaderboardView
  onBenchmarkChange: (benchmark: string) => void
  onSetupChange: (benchmark: string, comparisonHash: string) => void
}

// §8.6 item 4: a ranked board for exactly one benchmark and setup --
// the depth complement to Overview's breadth. `view.sortColumn` is the
// benchmark on display; the same URL field Overview uses to pick its
// sorted column, so switching lenses keeps the same benchmark in focus.
export function LeaderboardBenchmarkTable({
  allColumns,
  filteredModels,
  view,
  onBenchmarkChange,
  onSetupChange,
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

  const setup = resolveSetupForBenchmark(column, view.setupOverrides)
  const rankedRows = buildRankedRows(setup, filteredModels)
  const notEvaluatedModels = buildNotEvaluatedModels(setup, filteredModels)
  const domain = computeIntervalDomain(rankedRows.map((row) => row.cell))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SelectField
          className="w-56"
          value={column.benchmark}
          onChange={(event) => onBenchmarkChange(event.target.value)}
          aria-label="Benchmark"
        >
          {allColumns.map((candidate) => (
            <option key={candidate.benchmark} value={candidate.benchmark}>
              {candidate.displayName}
            </option>
          ))}
        </SelectField>
        <SelectField
          className="w-56"
          value={setup.comparisonHash}
          onChange={(event) => onSetupChange(column.benchmark, event.target.value)}
          aria-label="Setup"
        >
          {column.setups.map((candidate) => (
            <option key={candidate.comparisonHash} value={candidate.comparisonHash}>
              {samplingProfileDisplayName(candidate.samplingProfileLabel, candidate.samplingProfileHash)} ·{' '}
              {candidate.modelCount} model{candidate.modelCount === 1 ? '' : 's'}
            </option>
          ))}
        </SelectField>
      </div>

      {rankedRows.length === 0 ? (
        <EmptyState title="No results on this setup yet" description="Run an evaluation to see ranked results here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>Rank</TableHeaderCell>
              <TableHeaderCell>Model</TableHeaderCell>
              <TableHeaderCell className="text-right">Score</TableHeaderCell>
              <TableHeaderCell>95% margin of error</TableHeaderCell>
              <TableHeaderCell className="text-right">Samples</TableHeaderCell>
              <TableHeaderCell className="text-right">Truncated</TableHeaderCell>
              <TableHeaderCell>Serving</TableHeaderCell>
              <TableHeaderCell>Evaluated</TableHeaderCell>
              <TableHeaderCell />
            </tr>
          </thead>
          <tbody>
            {rankedRows.map((row) => (
              <LeaderboardBenchmarkRow
                key={row.model.checkpointId}
                column={column}
                setup={setup}
                row={row}
                domain={domain}
                density={view.density}
              />
            ))}
          </tbody>
        </Table>
      )}

      <LeaderboardNotEvaluatedList standardId={setup.standardId} models={notEvaluatedModels} />
    </div>
  )
}

interface LeaderboardBenchmarkRowProps {
  column: BenchmarkColumn
  setup: SetupOption
  row: RankedRow
  domain: { min: number; max: number }
  density: ResolvedLeaderboardView['density']
}

function LeaderboardBenchmarkRow({ column, setup, row, domain, density }: LeaderboardBenchmarkRowProps) {
  const { model, cell } = row
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
      <TableCell className={padding}>{cell.servingProfileLabel ?? shortFingerprint(cell.servingProfileHash)}</TableCell>
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
