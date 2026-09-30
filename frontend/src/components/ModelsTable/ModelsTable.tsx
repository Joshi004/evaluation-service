import type { CheckpointListItem } from '../../api/client'
import type { LeaderboardBoard } from '../../utils/buildLeaderboard'
import { familySpellingsHint, type FamilyGroup } from '../../utils/familyGroups'
import type { ModelOverview } from '../../pages/ModelsPage.helper'
import { paths } from '../../utils/paths'
import { AvailabilityBadge } from '../AvailabilityBadge/AvailabilityBadge'
import { CompareWithModelButton } from '../CompareWithModelButton/CompareWithModelButton'
import { ModelLatestScores } from '../ModelLatestScores/ModelLatestScores'
import { ModelLineageIndicator } from '../ModelLineageIndicator/ModelLineageIndicator'
import { ModelName } from '../ModelName/ModelName'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'

interface ModelsTableProps {
  groups: FamilyGroup[]
  overviewByCheckpointId: Map<number, ModelOverview>
  allCheckpoints: CheckpointListItem[]
  board: LeaderboardBoard
}

// Name, Availability, Latest scores, Lineage, Last evaluated, Runs.
const COLUMN_COUNT = 6

// The table view's own grouped rows (docs/UI_REDESIGN_PLAN.md §8.11) --
// one <tbody> per family group with its own header row, mirroring
// RunsTable's own batch-grouped sections so the app has one visual
// language for "a table with sections", not two.
export function ModelsTable({ groups, overviewByCheckpointId, allCheckpoints, board }: ModelsTableProps) {
  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Availability</TableHeaderCell>
          <TableHeaderCell>Latest scores</TableHeaderCell>
          <TableHeaderCell>Lineage</TableHeaderCell>
          <TableHeaderCell>Last evaluated</TableHeaderCell>
          <TableHeaderCell>Runs</TableHeaderCell>
          <TableHeaderCell />
        </tr>
      </thead>
      {groups.map((group) => {
        const spellingsHint = familySpellingsHint(group)
        return (
          <tbody key={group.key}>
            <tr>
              <TableCell colSpan={COLUMN_COUNT + 1} className="bg-muted text-xs font-medium text-muted-foreground">
                {group.label}
                {spellingsHint && <span className="ml-1.5 font-normal">({spellingsHint})</span>}
              </TableCell>
            </tr>
            {group.checkpoints.map((checkpoint) => {
              const overview = overviewByCheckpointId.get(checkpoint.id)
              if (!overview) {
                return null
              }
              return (
                <tr key={checkpoint.id}>
                  <TableCell>
                    <ModelName name={checkpoint.name} to={paths.model(checkpoint.id)} />
                  </TableCell>
                  <TableCell>
                    <AvailabilityBadge status={checkpoint.availability_status} />
                  </TableCell>
                  <TableCell>
                    <ModelLatestScores evaluated={overview.results.evaluated} />
                  </TableCell>
                  <TableCell>
                    <ModelLineageIndicator lineage={overview.lineage} />
                  </TableCell>
                  <TableCell>
                    {overview.lastEvaluatedAt === null ? (
                      <span className="text-muted-foreground">Not evaluated yet</span>
                    ) : (
                      <RelativeTime timestamp={overview.lastEvaluatedAt} />
                    )}
                  </TableCell>
                  <TableCell>{overview.runCounts.all}</TableCell>
                  <TableCell>
                    <CompareWithModelButton checkpoint={checkpoint} allCheckpoints={allCheckpoints} board={board} />
                  </TableCell>
                </tr>
              )
            })}
          </tbody>
        )
      })}
    </Table>
  )
}
