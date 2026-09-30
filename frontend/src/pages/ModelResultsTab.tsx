import { ModelResultsTable } from '../components/ModelResultsTable/ModelResultsTable'
import { ModelScorecard } from '../components/ModelScorecard/ModelScorecard'
import { buildModelResults } from '../utils/modelResults'
import { useModelPage } from './ModelDetailPage.helper'

// The model page's default tab (docs/UI_REDESIGN_PLAN.md section
// 8.11): ModelScorecard (evaluated setups as cards, plus muted "Not
// evaluated" cards with Run it), then the full benchmark x setup table
// below it. Both read the same buildModelResults reshape of the
// already-built board -- ModelDetailPage.helper.ts's own context --
// never a second ranking computation.
export function ModelResultsTab() {
  const { checkpoint, board, standards } = useModelPage()
  const { evaluated, notEvaluated } = buildModelResults(board, standards, checkpoint.id)

  if (evaluated.length === 0 && notEvaluated.length === 0) {
    return <p className="text-sm text-muted-foreground">There are no catalog benchmarks yet.</p>
  }

  return (
    <div className="space-y-6">
      <ModelScorecard checkpointId={checkpoint.id} evaluated={evaluated} notEvaluated={notEvaluated} />
      <ModelResultsTable checkpointId={checkpoint.id} modelName={checkpoint.name} evaluated={evaluated} />
    </div>
  )
}
