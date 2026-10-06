import { Link } from 'react-router'
import type { ModelRow } from '../../utils/buildLeaderboard'
import { paths } from '../../utils/paths'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { ModelName } from '../ModelName/ModelName'

interface LeaderboardNotEvaluatedListProps {
  standardId: number
  models: ModelRow[]
}

// By-benchmark lens's own empty-cell equivalent: every filtered model
// with no result on any setup of the board's benchmark, each with a
// direct way to fill the gap.
export function LeaderboardNotEvaluatedList({ standardId, models }: LeaderboardNotEvaluatedListProps) {
  if (models.length === 0) {
    return null
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground">Not yet evaluated on this benchmark ({models.length})</p>
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
        {models.map((model) => (
          <li key={model.checkpointId} className="flex items-center justify-between gap-3 px-3 py-2">
            <ModelName name={model.name} family={model.family} to={paths.model(model.checkpointId)} />
            <Link
              to={paths.newEvaluation({ models: [model.checkpointId], benchmarks: [standardId] })}
              className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}
            >
              Run it
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
