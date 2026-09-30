import { Link } from 'react-router'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ScopedRunsList } from '../components/ScopedRunsList/ScopedRunsList'
import { paths } from '../utils/paths'
import { useModelPage } from './ModelDetailPage.helper'

// The model page's Runs tab: this model's own runs (already scoped
// server-side by ModelDetailPage's own `useRuns({ checkpoint_id: id
// })`), rendered through the shared ScopedRunsList.
export function ModelRunsTab() {
  const { checkpoint, runs } = useModelPage()

  return (
    <ScopedRunsList
      runs={runs}
      openInRunsHref={paths.runs({ model: checkpoint.id })}
      emptyState={
        <EmptyState
          title="No runs yet"
          description="Evaluate this model to see its runs here."
          actions={
            <Link
              to={paths.newEvaluation({ models: [checkpoint.id] })}
              className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}
            >
              Evaluate
            </Link>
          }
        />
      }
    />
  )
}
