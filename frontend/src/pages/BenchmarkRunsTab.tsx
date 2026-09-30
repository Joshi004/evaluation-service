import { Link } from 'react-router'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ScopedRunsList } from '../components/ScopedRunsList/ScopedRunsList'
import { paths } from '../utils/paths'
import { useBenchmarkPage } from './BenchmarkDetailPage.helper'

// The Benchmark detail page's Runs tab (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12): this standard version's own runs
// (already scoped server-side by BenchmarkDetailPage's own
// `useRuns({ standard_id: id })`), rendered through the same
// ScopedRunsList ModelRunsTab uses.
export function BenchmarkRunsTab() {
  const { standard, runs } = useBenchmarkPage()

  return (
    <ScopedRunsList
      runs={runs}
      openInRunsHref={paths.runs({ benchmark: standard.benchmark })}
      emptyState={
        <EmptyState
          title="No runs yet"
          description="Evaluate this benchmark to see its runs here."
          actions={
            <Link
              to={paths.newEvaluation({ benchmarks: [standard.id] })}
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
