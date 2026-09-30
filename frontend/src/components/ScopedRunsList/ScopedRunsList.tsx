import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { RunListItem } from '../../api/client'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { EmptyState } from '../EmptyState/EmptyState'
import { RunStatusFilter } from '../RunStatusFilter/RunStatusFilter'
import { RunsTable } from '../RunsTable/RunsTable'
import {
  countActiveRuns,
  countRunsByStatus,
  matchesRunsStatusFilter,
  RUNS_STATUS_FILTER_VALUES,
  type RunsStatusFilter as RunsStatusFilterValue,
} from '../../utils/runStatus'
import { useNow } from '../../utils/useNow'
import { readEnumParam, useUrlState, type UrlParamValue } from '../../utils/useUrlState'

// The index signature only satisfies useUrlState's own
// `T extends Record<string, UrlParamValue>` constraint (mirrors
// RunsUrlParams' own docstring in RunsPage.helper.ts).
interface ScopedRunsUrlParams {
  [key: string]: UrlParamValue
  status: RunsStatusFilterValue
}

const SCOPED_RUNS_URL_DEFAULTS: ScopedRunsUrlParams = { status: 'all' }

interface ScopedRunsListProps {
  // Already scoped server-side by the caller's own useRuns filter
  // (checkpoint_id for a model, standard_id for a benchmark) --
  // narrowed further here only by a status filter in the URL.
  runs: RunListItem[]
  // Where "Open in Runs" goes -- each caller's own paths.runs(...)
  // filter (a model's own runs, or a benchmark's).
  openInRunsHref: string
  // What to show instead of the table when `runs` is empty -- each
  // caller's own wording and "Evaluate" link.
  emptyState: ReactNode
}

// A flat RunsTable of one already-scoped run list, narrowed by a
// `?status=` filter in the URL -- shared by ModelRunsTab.tsx and the
// Benchmark detail page's own Runs tab, which need the identical shape
// for different scopes. RunsTable itself is reused unchanged, per its
// own module comment.
export function ScopedRunsList({ runs, openInRunsHref, emptyState }: ScopedRunsListProps) {
  const [searchParams, setUrlParams] = useUrlState<ScopedRunsUrlParams>(SCOPED_RUNS_URL_DEFAULTS)
  const status = readEnumParam(searchParams, 'status', RUNS_STATUS_FILTER_VALUES, 'all')

  // Ticks every second while one of these runs is active, same
  // reasoning as RunsPage.tsx's own useNow call.
  const now = useNow(countActiveRuns(runs) > 0 ? 1000 : 60_000)

  function handleStatusChange(next: RunsStatusFilterValue): void {
    setUrlParams({ status: next })
  }

  if (runs.length === 0) {
    return <>{emptyState}</>
  }

  const statusCounts = countRunsByStatus(runs)
  const visibleRuns = runs.filter((run) => matchesRunsStatusFilter(run, status))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RunStatusFilter value={status} counts={statusCounts} onChange={handleStatusChange} />
        <Link to={openInRunsHref} className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}>
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
