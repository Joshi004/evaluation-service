import { Link } from 'react-router'
import type { StandardSummary } from '../../api/client'
import { buildBestResults, buildRankedRows, type LeaderboardBoard } from '../../utils/buildLeaderboard'
import { paths } from '../../utils/paths'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { EmptyState } from '../EmptyState/EmptyState'
import { ModelName } from '../ModelName/ModelName'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SetupChip } from '../SetupChip/SetupChip'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { Tooltip } from '../Tooltip/Tooltip'

interface BenchmarkLeaderboardPreviewProps {
  standard: StandardSummary
  board: LeaderboardBoard
}

const PREVIEW_ROW_COUNT = 5

// The Benchmark Overview tab's own leaderboard slice: the board's
// column for this benchmark, narrowed to setups on *this* standard
// version -- this page is only ever about one version, but a column
// can mix e.g. ifeval/v1 and ifeval/v2 setups together -- then each
// model's best result across those setups, top 5, ranked the same way
// the By-benchmark lens ranks them (buildBestResults, then
// buildRankedRows).
export function BenchmarkLeaderboardPreview({ standard, board }: BenchmarkLeaderboardPreviewProps) {
  const column = board.columns.find((candidate) => candidate.benchmark === standard.benchmark)
  const setupsForThisStandard = column?.setups.filter((setup) => setup.standardId === standard.id) ?? []

  if (!column || setupsForThisStandard.length === 0) {
    return (
      <EmptyState
        title="No results yet"
        description="Evaluate a model on this benchmark to see ranked results here."
        actions={
          <Link
            to={paths.newEvaluation({ benchmarks: [standard.id] })}
            className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}
          >
            Run it
          </Link>
        }
      />
    )
  }

  const bestResults = buildBestResults(setupsForThisStandard, column.higherIsBetter)
  const rankedRows = buildRankedRows(bestResults, board.models).slice(0, PREVIEW_ROW_COUNT)

  return (
    <div className="space-y-3">
      <Table>
        <thead>
          <tr>
            <TableHeaderCell>Rank</TableHeaderCell>
            <TableHeaderCell>Model</TableHeaderCell>
            <TableHeaderCell>Setup</TableHeaderCell>
            <TableHeaderCell className="text-right">Score</TableHeaderCell>
          </tr>
        </thead>
        <tbody>
          {rankedRows.map((row) => (
            <tr key={row.model.checkpointId}>
              <TableCell className="tabular-nums">
                {row.cell.rank}
                {row.cell.withinLeaderMargin && (
                  <Tooltip content="Within the leader's margin of error (the intervals overlap)">
                    <span tabIndex={0} className="ml-1 text-muted-foreground">
                      ≈
                    </span>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell>
                <ModelName name={row.model.name} family={row.model.family} to={paths.model(row.model.checkpointId)} />
              </TableCell>
              <TableCell>
                <SetupChip
                  samplingProfileLabel={row.setup.samplingProfileLabel}
                  samplingProfileHash={row.setup.samplingProfileHash}
                />
              </TableCell>
              <TableCell className="text-right">
                <ScoreValue value={row.cell.value} />
              </TableCell>
            </tr>
          ))}
        </tbody>
      </Table>

      <Link
        to={paths.leaderboard({ benchmark: standard.benchmark })}
        className="text-sm font-medium text-primary hover:underline"
      >
        View full ranking
      </Link>
    </div>
  )
}
