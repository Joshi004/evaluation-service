import { Link } from 'react-router'
import type { CheckpointListItem } from '../../api/client'
import type { LeaderboardBoard } from '../../utils/buildLeaderboard'
import type { ModelOverview } from '../../pages/ModelsPage.helper'
import { paths } from '../../utils/paths'
import { AvailabilityBadge } from '../AvailabilityBadge/AvailabilityBadge'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { Card } from '../Card/Card'
import { CompareWithModelButton } from '../CompareWithModelButton/CompareWithModelButton'
import { ModelLatestScores } from '../ModelLatestScores/ModelLatestScores'
import { ModelLineageIndicator } from '../ModelLineageIndicator/ModelLineageIndicator'
import { ModelName } from '../ModelName/ModelName'
import { RelativeTime } from '../RelativeTime/RelativeTime'

interface ModelCardProps {
  overview: ModelOverview
  allCheckpoints: CheckpointListItem[]
  board: LeaderboardBoard
}

// One model's card -- the Models list' own cards view (the default),
// grouped into family sections by
// the page. ModelsTable shows the same fields as table columns instead
// for the same grouped list.
export function ModelCard({ overview, allCheckpoints, board }: ModelCardProps) {
  const { checkpoint, results, lastEvaluatedAt, lineage, runCounts } = overview

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <ModelName name={checkpoint.name} to={paths.model(checkpoint.id)} />
        <AvailabilityBadge status={checkpoint.availability_status} />
      </div>

      <ModelLatestScores evaluated={results.evaluated} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <ModelLineageIndicator lineage={lineage} />
        <span>
          {lastEvaluatedAt === null ? (
            'Not evaluated yet'
          ) : (
            <>
              Last evaluated <RelativeTime timestamp={lastEvaluatedAt} />
            </>
          )}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {runCounts.all} run{runCounts.all === 1 ? '' : 's'}
        {runCounts.active > 0 && ` \u00b7 ${runCounts.active} active`}
        {runCounts.failed > 0 && ` \u00b7 ${runCounts.failed} failed`}
      </p>

      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        <Link to={paths.model(checkpoint.id)} className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}>
          View
        </Link>
        <CompareWithModelButton checkpoint={checkpoint} allCheckpoints={allCheckpoints} board={board} />
      </div>
    </Card>
  )
}
