import { Link } from 'react-router'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ModelResultsTable } from '../components/ModelResultsTable/ModelResultsTable'
import { ModelScorecard } from '../components/ModelScorecard/ModelScorecard'
import { buildModelResults } from '../utils/modelResults'
import { paths } from '../utils/paths'
import { useModelPage } from './ModelDetailPage.helper'

// The model page's default tab: ModelScorecard (evaluated setups as
// cards, plus muted "Not evaluated" cards with Run it), then the full
// benchmark x setup table below it. Both read the same
// buildModelResults reshape of the
// already-built board -- ModelDetailPage.helper.ts's own context --
// never a second ranking computation.
export function ModelResultsTab() {
  const { checkpoint, board, standards } = useModelPage()
  const { evaluated, notEvaluated } = buildModelResults(board, standards, checkpoint.id)

  if (evaluated.length === 0 && notEvaluated.length === 0) {
    return (
      <EmptyState
        title="No results yet"
        description="There are no catalog benchmarks to evaluate this model against yet."
        actions={
          <Link
            to={paths.newEvaluation({ models: [checkpoint.id] })}
            className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}
          >
            New evaluation
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <ModelScorecard checkpointId={checkpoint.id} evaluated={evaluated} notEvaluated={notEvaluated} />
      <ModelResultsTable checkpointId={checkpoint.id} modelName={checkpoint.name} evaluated={evaluated} />
    </div>
  )
}
