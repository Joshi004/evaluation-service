import { Link } from 'react-router'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { RunStatusFilter } from '../components/RunStatusFilter/RunStatusFilter'
import { RunsTable } from '../components/RunsTable/RunsTable'
import { paths } from '../utils/paths'
import {
  countActiveRuns,
  countRunsByStatus,
  matchesRunsStatusFilter,
  RUNS_STATUS_FILTER_VALUES,
  type RunsStatusFilter as RunsStatusFilterValue,
} from '../utils/runStatus'
import { useNow } from '../utils/useNow'
import { readEnumParam, useUrlState, type UrlParamValue } from '../utils/useUrlState'
import { useModelPage } from './ModelDetailPage.helper'

// The index signature only satisfies useUrlState's own
// `T extends Record<string, UrlParamValue>` constraint (mirrors
// RunsUrlParams' own docstring in RunsPage.helper.ts).
interface ModelRunsUrlParams {
  [key: string]: UrlParamValue
  status: RunsStatusFilterValue
}

const MODEL_RUNS_URL_DEFAULTS: ModelRunsUrlParams = { status: 'all' }

// The model page's Runs tab (docs/UI_REDESIGN_PLAN.md §8.11): a flat
// RunsTable of this one model's own runs (already scoped server-side
// by ModelDetailPage's own `useRuns({ checkpoint_id: id })`), narrowed
// further by a status filter in the URL -- RunsTable itself is reused
// unchanged, per its own module comment.
export function ModelRunsTab() {
  const { checkpoint, runs } = useModelPage()
  const [searchParams, setUrlParams] = useUrlState<ModelRunsUrlParams>(MODEL_RUNS_URL_DEFAULTS)
  const status = readEnumParam(searchParams, 'status', RUNS_STATUS_FILTER_VALUES, 'all')

  // Ticks every second while one of this model's own runs is active,
  // same reasoning as RunsPage.tsx's own useNow call.
  const now = useNow(countActiveRuns(runs) > 0 ? 1000 : 60_000)

  function handleStatusChange(next: RunsStatusFilterValue): void {
    setUrlParams({ status: next })
  }

  if (runs.length === 0) {
    return (
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
    )
  }

  const statusCounts = countRunsByStatus(runs)
  const visibleRuns = runs.filter((run) => matchesRunsStatusFilter(run, status))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RunStatusFilter value={status} counts={statusCounts} onChange={handleStatusChange} />
        <Link to={paths.runs({ model: checkpoint.id })} className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}>
          Open in Runs
        </Link>
      </div>

      {visibleRuns.length === 0 ? (
        <EmptyState title="No runs match this filter" description="Try a different status." />
      ) : (
        <RunsTable visibleRuns={visibleRuns} allRuns={runs} viewMode="flat" now={now} />
      )}
    </div>
  )
}
