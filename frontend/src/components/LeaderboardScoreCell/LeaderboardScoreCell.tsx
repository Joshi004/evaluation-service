import { Star } from 'lucide-react'
import { Link } from 'react-router'
import { DENSITY_CELL_PADDING, type LeaderboardDensity } from '../../pages/LeaderboardPage.helper'
import type { BenchmarkColumn, ModelRow } from '../../utils/buildLeaderboard'
import { cn } from '../../utils/cn'
import { paths } from '../../utils/paths'
import { HoverCard } from '../HoverCard/HoverCard'
import { LeaderboardScoreCard } from '../LeaderboardScoreCard/LeaderboardScoreCard'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { TableCell } from '../Table/Table'
import { HEAT_BACKGROUND_CLASSES, leaderStarLabel, type ScoreCellContent } from './LeaderboardScoreCell.helper'

interface LeaderboardScoreCellProps {
  column: BenchmarkColumn
  model: ModelRow
  // Already resolved for the current mode (LeaderboardScoreCell.helper.ts)
  // -- this component renders; it does not decide which result a cell shows.
  content: ScoreCellContent
  heatEnabled: boolean
  density: LeaderboardDensity
}

// One Overview matrix cell: a score with its ★, an optional heat tint,
// a quiet "+N" marker when this model also ran other setups of the
// benchmark (the hover card lists them), or a "Run it" link when this
// model has nothing to show here.
export function LeaderboardScoreCell({ column, model, content, heatEnabled, density }: LeaderboardScoreCellProps) {
  const { result, otherSetups, rankScope, runItStandardId } = content

  if (!result) {
    return (
      <TableCell className={cn('text-right', DENSITY_CELL_PADDING[density])}>
        <Link
          to={paths.newEvaluation({ models: [model.checkpointId], benchmarks: [runItStandardId] })}
          className="text-xs font-medium text-primary hover:underline"
        >
          Run it
        </Link>
      </TableCell>
    )
  }

  const { setup, cell } = result
  const star = cell.isLeader || cell.withinLeaderMargin
  const otherSetupsLabel = `${otherSetups.length} other setup${otherSetups.length === 1 ? '' : 's'}`

  return (
    <TableCell
      className={cn(
        'text-right align-middle',
        DENSITY_CELL_PADDING[density],
        heatEnabled && HEAT_BACKGROUND_CLASSES[cell.heatLevel],
      )}
    >
      <div className="flex items-center justify-end">
        <HoverCard
          trigger={
            // A link, not a button: hovering or focusing it opens the
            // card below (HoverCard's own handlers work on any element),
            // but a plain click still goes straight to the run -- a
            // cell click always opens the run, even though the same
            // cell also has a richer card for anyone who pauses on it.
            <Link
              to={paths.run(cell.evalRunId)}
              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-foreground hover:bg-muted"
            >
              {otherSetups.length > 0 && (
                <>
                  <span className="mr-0.5 text-[11px] font-medium text-subtle-foreground" aria-hidden="true">
                    +{otherSetups.length}
                  </span>
                  <span className="sr-only">{otherSetupsLabel}</span>
                </>
              )}
              {star && (
                <>
                  <Star className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                  <span className="sr-only">{leaderStarLabel(rankScope, cell.isLeader)}</span>
                </>
              )}
              <ScoreValue value={cell.value} interval={cell.confidenceInterval} />
            </Link>
          }
        >
          <LeaderboardScoreCard
            column={column}
            model={model}
            setup={setup}
            cell={cell}
            otherSetups={otherSetups}
            rankScope={rankScope}
          />
        </HoverCard>
      </div>
    </TableCell>
  )
}
