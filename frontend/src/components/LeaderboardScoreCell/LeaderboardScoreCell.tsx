import { Star } from 'lucide-react'
import { Link } from 'react-router'
import { DENSITY_CELL_PADDING, type LeaderboardDensity } from '../../pages/LeaderboardPage.helper'
import type { BenchmarkColumn, ModelRow, SetupOption } from '../../utils/buildLeaderboard'
import { cn } from '../../utils/cn'
import { paths } from '../../utils/paths'
import { HoverCard } from '../HoverCard/HoverCard'
import { LeaderboardScoreCard } from '../LeaderboardScoreCard/LeaderboardScoreCard'
import { Popover } from '../Popover/Popover'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { TableCell } from '../Table/Table'
import { HEAT_BACKGROUND_CLASSES, otherSetupsForModel } from './LeaderboardScoreCell.helper'

interface LeaderboardScoreCellProps {
  column: BenchmarkColumn
  model: ModelRow
  setup: SetupOption
  heatEnabled: boolean
  density: LeaderboardDensity
  // False in All-setups mode: every setup is already its own visible
  // sub-column there, so a "+N other setup" chip would just point at
  // something already on screen.
  showOtherSetupsChip: boolean
}

// One Overview matrix cell (§8.6 item 3): a score with its ★, an
// optional heat tint, an optional "+N other setup" chip, or a "Run it"
// link when this model has no result on this setup.
export function LeaderboardScoreCell({
  column,
  model,
  setup,
  heatEnabled,
  density,
  showOtherSetupsChip,
}: LeaderboardScoreCellProps) {
  const cell = setup.cellsByCheckpointId[model.checkpointId]

  if (!cell) {
    return (
      <TableCell className={cn('text-right', DENSITY_CELL_PADDING[density])}>
        <Link
          to={paths.newEvaluation({ models: [model.checkpointId], benchmarks: [setup.standardId] })}
          className="text-xs font-medium text-primary hover:underline"
        >
          Run it
        </Link>
      </TableCell>
    )
  }

  const star = cell.isLeader || cell.withinLeaderMargin
  const otherSetups = showOtherSetupsChip ? otherSetupsForModel(column, model.checkpointId, setup.comparisonHash) : []

  return (
    <TableCell
      className={cn(
        'text-right align-middle',
        DENSITY_CELL_PADDING[density],
        heatEnabled && HEAT_BACKGROUND_CLASSES[cell.heatLevel],
      )}
    >
      <div className="flex items-center justify-end gap-2">
        {otherSetups.length > 0 && (
          <Popover
            align="end"
            trigger={
              <button
                type="button"
                className="rounded-full border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:border-border-strong hover:text-foreground"
              >
                +{otherSetups.length} other setup{otherSetups.length > 1 ? 's' : ''}
              </button>
            }
          >
            <p className="mb-2 text-xs font-medium text-foreground">Also evaluated under</p>
            <ul className="space-y-1.5">
              {otherSetups.map((otherSetup) => {
                const otherCell = otherSetup.cellsByCheckpointId[model.checkpointId]
                return (
                  <li key={otherSetup.comparisonHash}>
                    <Link
                      to={paths.run(otherCell.evalRunId)}
                      className="flex items-center justify-between gap-4 text-xs hover:underline"
                    >
                      <span className="text-muted-foreground">
                        {otherSetup.samplingProfileLabel ?? otherSetup.samplingProfileHash}
                      </span>
                      <ScoreValue value={otherCell.value} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Popover>
        )}
        <HoverCard
          trigger={
            // A link, not a button: hovering or focusing it opens the
            // card below (HoverCard's own handlers work on any element),
            // but a plain click still goes straight to the run -- §8.6's
            // "cell click opens the run" holds even though the same
            // cell also has a richer card for anyone who pauses on it.
            <Link
              to={paths.run(cell.evalRunId)}
              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-foreground hover:bg-muted"
            >
              {star && <Star className="h-3.5 w-3.5 text-warning" aria-hidden="true" />}
              <ScoreValue value={cell.value} interval={cell.confidenceInterval} />
            </Link>
          }
        >
          <LeaderboardScoreCard column={column} model={model} setup={setup} cell={cell} />
        </HoverCard>
      </div>
    </TableCell>
  )
}
