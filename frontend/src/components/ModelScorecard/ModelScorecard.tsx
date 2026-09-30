import { Link } from 'react-router'
import type { ModelEvaluatedResult, ModelNotEvaluatedResult } from '../../utils/modelResults'
import { paths } from '../../utils/paths'
import { BenchmarkName } from '../BenchmarkName/BenchmarkName'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { Card } from '../Card/Card'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SetupChip } from '../SetupChip/SetupChip'
import { Tooltip } from '../Tooltip/Tooltip'

interface ModelScorecardProps {
  checkpointId: number
  evaluated: ModelEvaluatedResult[]
  notEvaluated: ModelNotEvaluatedResult[]
}

// The Results tab's own scorecard (docs/UI_REDESIGN_PLAN.md section
// 8.11): one card per (benchmark, setup) this model has a done result
// on, plus a muted card per catalog benchmark it doesn't -- "Not
// evaluated" is never a silent gap, it's always paired with a way to
// close it.
export function ModelScorecard({ checkpointId, evaluated, notEvaluated }: ModelScorecardProps) {
  if (evaluated.length === 0 && notEvaluated.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {evaluated.map((entry) => (
        <EvaluatedCard key={`${entry.benchmark}-${entry.setup.comparisonHash}`} entry={entry} />
      ))}
      {notEvaluated.map((entry) => (
        <NotEvaluatedCard key={entry.benchmark} checkpointId={checkpointId} entry={entry} />
      ))}
    </div>
  )
}

function EvaluatedCard({ entry }: { entry: ModelEvaluatedResult }) {
  const { benchmark, setup, cell } = entry

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <BenchmarkName benchmark={benchmark} standardLabel={setup.standardLabel} />
        <SetupChip samplingProfileLabel={setup.samplingProfileLabel} samplingProfileHash={setup.samplingProfileHash} />
      </div>
      <ScoreValue value={cell.value} interval={cell.confidenceInterval} className="text-lg" />
      <p className="text-xs text-muted-foreground">
        #{cell.rank} of {setup.modelCount}
        {cell.withinLeaderMargin && (
          <Tooltip content="Within the leader's margin of error (the intervals overlap)">
            <span tabIndex={0} className="ml-1">
              ≈
            </span>
          </Tooltip>
        )}
      </p>
      <Link to={paths.run(cell.evalRunId)} className="mt-auto text-xs font-medium text-primary hover:underline">
        Open run
      </Link>
    </Card>
  )
}

function NotEvaluatedCard({ checkpointId, entry }: { checkpointId: number; entry: ModelNotEvaluatedResult }) {
  return (
    <Card className="flex flex-col gap-2 border-dashed bg-transparent">
      <BenchmarkName benchmark={entry.benchmark} />
      <p className="text-xs text-muted-foreground">Not evaluated</p>
      <Link
        to={paths.newEvaluation({ models: [checkpointId], benchmarks: [entry.standardId] })}
        className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}
      >
        Run it
      </Link>
    </Card>
  )
}
