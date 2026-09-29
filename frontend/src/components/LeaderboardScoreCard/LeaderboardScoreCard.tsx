import { Star } from 'lucide-react'
import { Link } from 'react-router'
import type { BenchmarkColumn, ModelRow, ScoreCellData, SetupOption } from '../../utils/buildLeaderboard'
import { compareCandidateFromLeaderboardCell } from '../../utils/compareTray'
import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'
import { paths } from '../../utils/paths'
import { AddToCompareButton } from '../AddToCompareButton/AddToCompareButton'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SetupChip } from '../SetupChip/SetupChip'
import { Tooltip } from '../Tooltip/Tooltip'

interface LeaderboardScoreCardProps {
  column: BenchmarkColumn
  model: ModelRow
  setup: SetupOption
  cell: ScoreCellData
}

// The Overview cell's hover/focus card content (§4.4.2's sketch): score
// with its interval and sample count, a passed/failed count, every
// field that tells the setup apart, and the four actions the sketch
// lists. Renders inside HoverCard, which supplies the hover/focus/Tab
// behaviour -- this component only renders content.
export function LeaderboardScoreCard({ column, model, setup, cell }: LeaderboardScoreCardProps) {
  // `round(score * samples)` is only valid for a pass-rate primary
  // metric -- the same assumption behind the Wilson interval itself
  // (report_summary.py's own guard), true for every benchmark today.
  // A future non-pass-rate primary metric would need this line
  // removed, not just recalculated.
  const passed = cell.nSamples === null ? null : Math.round(cell.value * cell.nSamples)
  const failed = passed === null || cell.nSamples === null ? null : cell.nSamples - passed

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <ScoreValue value={cell.value} interval={cell.confidenceInterval} samples={cell.nSamples} className="text-base" />
        {(cell.isLeader || cell.withinLeaderMargin) && (
          <Tooltip content={cell.isLeader ? 'Leads this setup' : 'Within margin of error of the leader'}>
            <span tabIndex={0}>
              <Star className="h-4 w-4 text-warning" aria-hidden="true" />
            </span>
          </Tooltip>
        )}
      </div>

      {passed !== null && failed !== null && (
        <p className="text-xs text-muted-foreground">
          {passed} of {cell.nSamples} passed · {failed} failed
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">Setup</dt>
        <dd>
          <SetupChip samplingProfileLabel={setup.samplingProfileLabel} samplingProfileHash={setup.samplingProfileHash} />
        </dd>
        <dt className="text-muted-foreground">Serving</dt>
        <dd className="text-foreground">{cell.servingProfileLabel ?? cell.servingProfileHash}</dd>
        <dt className="text-muted-foreground">Truncated</dt>
        <dd className="text-foreground">{formatFractionAsPercent(cell.truncationRate)}</dd>
        <dt className="text-muted-foreground">Evaluated</dt>
        <dd className="text-foreground">
          <RelativeTime timestamp={cell.finishedAt} />
        </dd>
      </dl>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <Link to={paths.run(cell.evalRunId)} className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}>
          Open run
        </Link>
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
        <Link
          to={`${paths.runSamples(cell.evalRunId)}?outcome=failed`}
          className="text-xs font-medium text-primary hover:underline"
        >
          View failures
        </Link>
        <Link
          to={paths.runs({ model: model.checkpointId, benchmark: column.benchmark })}
          className="text-xs font-medium text-primary hover:underline"
        >
          Run history
        </Link>
      </div>
    </div>
  )
}
