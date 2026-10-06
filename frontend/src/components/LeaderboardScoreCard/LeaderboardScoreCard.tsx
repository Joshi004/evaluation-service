import { Star } from 'lucide-react'
import { Link } from 'react-router'
import type { BenchmarkColumn, ModelRow, ScoreCellData, SetupOption, SetupResult } from '../../utils/buildLeaderboard'
import { compareCandidateFromLeaderboardCell } from '../../utils/compareTray'
import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'
import { TERM_HINTS } from '../../utils/labels'
import { paths } from '../../utils/paths'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'
import { AddToCompareButton } from '../AddToCompareButton/AddToCompareButton'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { LeaderboardOtherSetups } from '../LeaderboardOtherSetups/LeaderboardOtherSetups'
import { leaderStarLabel, type RankScope } from '../LeaderboardScoreCell/LeaderboardScoreCell.helper'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SetupChip } from '../SetupChip/SetupChip'
import { TermLabel } from '../TermLabel/TermLabel'
import { Tooltip } from '../Tooltip/Tooltip'

interface LeaderboardScoreCardProps {
  column: BenchmarkColumn
  model: ModelRow
  setup: SetupOption
  cell: ScoreCellData
  // This model's results on the benchmark's other setups -- empty in
  // All-setups mode, where each setup is already its own sub-column.
  otherSetups: SetupResult[]
  rankScope: RankScope
}

// The Overview cell's hover/focus card content: score with its
// interval and sample count, a passed/failed count, every field that
// tells the setup apart, the model's other setups on this benchmark
// (when it has any), and four actions. Renders inside HoverCard, which
// supplies the hover/focus/Tab behaviour -- this component only
// renders content.
export function LeaderboardScoreCard({ column, model, setup, cell, otherSetups, rankScope }: LeaderboardScoreCardProps) {
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
          <Tooltip content={leaderStarLabel(rankScope, cell.isLeader)}>
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
        <dt className="text-muted-foreground">
          <TermLabel hint={TERM_HINTS.setup}>Setup</TermLabel>
        </dt>
        <dd>
          <SetupChip samplingProfileLabel={setup.samplingProfileLabel} samplingProfileHash={setup.samplingProfileHash} />
        </dd>
        <dt className="text-muted-foreground">
          <TermLabel hint={TERM_HINTS.servingProfile}>Serving profile</TermLabel>
        </dt>
        <dd className="text-foreground">
          {servingProfileDisplayName(cell.servingProfileLabel, cell.servingProfileHash)}
        </dd>
        <dt className="text-muted-foreground">
          <TermLabel hint={TERM_HINTS.truncated}>Truncated</TermLabel>
        </dt>
        <dd className="text-foreground">{formatFractionAsPercent(cell.truncationRate)}</dd>
        <dt className="text-muted-foreground">Evaluated</dt>
        <dd className="text-foreground">
          <RelativeTime timestamp={cell.finishedAt} />
        </dd>
      </dl>

      {otherSetups.length > 0 && (
        <LeaderboardOtherSetups column={column} shown={{ setup, cell }} otherSetups={otherSetups} />
      )}

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
