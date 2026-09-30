import { Link } from 'react-router'
import type { SharedSetupComparison } from '../../utils/modelResults'
import { formatScoreDelta } from '../../utils/formatScore'
import { intervalsOverlap } from '../../utils/intervalsOverlap'
import { paths } from '../../utils/paths'
import { BenchmarkName } from '../BenchmarkName/BenchmarkName'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SetupChip } from '../SetupChip/SetupChip'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'

interface ModelParentComparisonProps {
  comparisons: SharedSetupComparison[]
}

// The Lineage tab's own "Compare with parent" delta table
// (docs/UI_REDESIGN_PLAN.md §8.11): one row per (benchmark, setup) both
// the model and its parent have a done result on, baseline = parent
// (findSharedSetups' own baseline-first convention). Δ reads "within
// margin of error" instead of a bare number whenever the two
// confidence intervals overlap, so a difference that isn't
// statistically meaningful never reads as a real regression or gain.
export function ModelParentComparison({ comparisons }: ModelParentComparisonProps) {
  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>Benchmark</TableHeaderCell>
          <TableHeaderCell>Setup</TableHeaderCell>
          <TableHeaderCell className="text-right">Parent</TableHeaderCell>
          <TableHeaderCell className="text-right">This model</TableHeaderCell>
          <TableHeaderCell className="text-right">Δ</TableHeaderCell>
          <TableHeaderCell />
        </tr>
      </thead>
      <tbody>
        {comparisons.map((comparison) => (
          <ComparisonRow key={`${comparison.benchmark}-${comparison.setup.comparisonHash}`} comparison={comparison} />
        ))}
      </tbody>
    </Table>
  )
}

function ComparisonRow({ comparison }: { comparison: SharedSetupComparison }) {
  const { benchmark, setup, baselineCell, otherCell } = comparison
  const delta = otherCell.value - baselineCell.value
  const withinMargin =
    baselineCell.confidenceInterval !== null &&
    otherCell.confidenceInterval !== null &&
    intervalsOverlap(baselineCell.confidenceInterval, otherCell.confidenceInterval)

  return (
    <tr>
      <TableCell>
        <BenchmarkName benchmark={benchmark} standardLabel={setup.standardLabel} />
      </TableCell>
      <TableCell>
        <SetupChip samplingProfileLabel={setup.samplingProfileLabel} samplingProfileHash={setup.samplingProfileHash} />
      </TableCell>
      <TableCell className="text-right">
        <ScoreValue value={baselineCell.value} interval={baselineCell.confidenceInterval} />
      </TableCell>
      <TableCell className="text-right">
        <ScoreValue value={otherCell.value} interval={otherCell.confidenceInterval} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatScoreDelta(delta)}
        {withinMargin && <span className="ml-1 text-xs text-muted-foreground">(within margin of error)</span>}
      </TableCell>
      <TableCell className="text-right">
        <Link
          to={paths.compare([baselineCell.evalRunId, otherCell.evalRunId])}
          className="text-xs font-medium text-primary hover:underline"
        >
          Compare
        </Link>
      </TableCell>
    </tr>
  )
}
