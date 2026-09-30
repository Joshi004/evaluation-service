import { Link } from 'react-router'
import { compareCandidateFromLeaderboardCell } from '../../utils/compareTray'
import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'
import type { ModelEvaluatedResult } from '../../utils/modelResults'
import { paths } from '../../utils/paths'
import { shortFingerprint } from '../../utils/shortFingerprint'
import { AddToCompareButton } from '../AddToCompareButton/AddToCompareButton'
import { BenchmarkName } from '../BenchmarkName/BenchmarkName'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SetupChip } from '../SetupChip/SetupChip'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { Tooltip } from '../Tooltip/Tooltip'

interface ModelResultsTableProps {
  checkpointId: number
  modelName: string
  evaluated: ModelEvaluatedResult[]
}

// The Results tab's own benchmark x setup table (docs/UI_REDESIGN_PLAN.md
// section 8.11): one row per (benchmark, setup) this model has a done
// result on -- chosen over a benchmark x sampling-profile matrix
// because a sampling label is not the same setup across benchmarks
// (section 4.3), so a shared column would imply a comparability that
// doesn't exist. Rank is read straight from the already-built board
// (cell.rank, cell.withinLeaderMargin), never re-derived, the same
// "Leaderboard ranks by construction" rule ModelScorecard follows.
export function ModelResultsTable({ checkpointId, modelName, evaluated }: ModelResultsTableProps) {
  if (evaluated.length === 0) {
    return null
  }

  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>Benchmark</TableHeaderCell>
          <TableHeaderCell>Setup</TableHeaderCell>
          <TableHeaderCell className="text-right">Score</TableHeaderCell>
          <TableHeaderCell>Rank</TableHeaderCell>
          <TableHeaderCell className="text-right">Samples</TableHeaderCell>
          <TableHeaderCell className="text-right">Truncated</TableHeaderCell>
          <TableHeaderCell>Serving</TableHeaderCell>
          <TableHeaderCell>Evaluated</TableHeaderCell>
          <TableHeaderCell />
        </tr>
      </thead>
      <tbody>
        {evaluated.map((entry) => (
          <ResultRow
            key={`${entry.benchmark}-${entry.setup.comparisonHash}`}
            checkpointId={checkpointId}
            modelName={modelName}
            entry={entry}
          />
        ))}
      </tbody>
    </Table>
  )
}

interface ResultRowProps {
  checkpointId: number
  modelName: string
  entry: ModelEvaluatedResult
}

function ResultRow({ checkpointId, modelName, entry }: ResultRowProps) {
  const { benchmark, setup, cell } = entry

  return (
    <tr>
      <TableCell>
        <BenchmarkName benchmark={benchmark} standardLabel={setup.standardLabel} />
      </TableCell>
      <TableCell>
        <SetupChip samplingProfileLabel={setup.samplingProfileLabel} samplingProfileHash={setup.samplingProfileHash} />
      </TableCell>
      <TableCell className="text-right">
        <ScoreValue value={cell.value} interval={cell.confidenceInterval} />
      </TableCell>
      <TableCell className="tabular-nums">
        #{cell.rank} of {setup.modelCount}
        {cell.withinLeaderMargin && (
          <Tooltip content="Within the leader's margin of error (the intervals overlap)">
            <span tabIndex={0} className="ml-1 text-muted-foreground">
              ≈
            </span>
          </Tooltip>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{cell.nSamples ?? '\u2014'}</TableCell>
      <TableCell className="text-right tabular-nums">{formatFractionAsPercent(cell.truncationRate)}</TableCell>
      <TableCell>{cell.servingProfileLabel ?? shortFingerprint(cell.servingProfileHash)}</TableCell>
      <TableCell>
        <RelativeTime timestamp={cell.finishedAt} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <AddToCompareButton
            candidate={compareCandidateFromLeaderboardCell({
              runId: cell.evalRunId,
              benchmark,
              comparisonHash: setup.comparisonHash,
              modelName,
              samplingProfileLabel: setup.samplingProfileLabel,
              samplingProfileHash: setup.samplingProfileHash,
              scoreFraction: cell.value,
            })}
          />
          <Link to={paths.run(cell.evalRunId)} className="text-xs font-medium text-primary hover:underline">
            Open run
          </Link>
          <Link
            to={paths.runs({ model: checkpointId, benchmark })}
            className="text-xs font-medium text-primary hover:underline"
          >
            Run history
          </Link>
        </div>
      </TableCell>
    </tr>
  )
}
