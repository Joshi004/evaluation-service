import { ChevronDown, ChevronRight } from 'lucide-react'
import { BatchProgressBar } from '../BatchProgressBar/BatchProgressBar'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { RunGroupCancelButton } from '../RunGroupCancelButton/RunGroupCancelButton'
import { describeBatchStatusBreakdown, type BatchSummary } from '../RunsTable/RunsTable.helper'

interface RunsBatchHeaderRowProps {
  batch: BatchSummary
  columnCount: number
  expanded: boolean
  onToggle: () => void
}

// One batch's own header (docs/UI_REDESIGN_PLAN.md §8.9, item 2) -- a
// single <th scope="rowgroup"> spanning every column, opening that
// batch's own <tbody>. Every number here reads `batch.allRunsInBatch`
// (built from the *unfiltered* run list, RunsTable.helper.ts), not
// whichever of its rows the current filters happen to show, since
// Cancel batch and the progress bar both describe the whole batch
// regardless of what's on screen underneath.
export function RunsBatchHeaderRow({ batch, columnCount, expanded, onToggle }: RunsBatchHeaderRowProps) {
  const totalRunCount = batch.allRunsInBatch.length
  const runsCountText =
    batch.visibleRunCount < totalRunCount
      ? `${totalRunCount} run${totalRunCount === 1 ? '' : 's'} \u00b7 ${batch.visibleRunCount} shown`
      : `${totalRunCount} run${totalRunCount === 1 ? '' : 's'}`
  const statusBreakdown = describeBatchStatusBreakdown(batch.allRunsInBatch)

  return (
    <tr>
      {/* A bespoke <th>, not the shared TableHeaderCell -- that
          primitive's own base classes (font-medium, py-2) would
          conflict with this row's font-normal/py-2.5 with no
          tailwind-merge to resolve the clash (one complete class
          string per caller). */}
      <th scope="rowgroup" colSpan={columnCount} className="bg-muted px-3 py-2.5 text-left align-top font-normal">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="truncate">{batch.runGroupName}</span>
              {batch.disambiguator && (
                <span className="shrink-0 text-xs font-normal text-muted-foreground">{batch.disambiguator}</span>
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              {runsCountText}
              {statusBreakdown !== '' && (
                <>
                  {' \u00b7 '}
                  {statusBreakdown}
                </>
              )}
            </p>
            <BatchProgressBar runs={batch.allRunsInBatch} className="max-w-xs" />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <RelativeTime timestamp={batch.createdAt} className="text-xs text-muted-foreground" />
            {batch.cancellableCount > 0 && (
              <RunGroupCancelButton
                runGroupId={batch.runGroupId}
                runGroupName={batch.runGroupName}
                cancellableCount={batch.cancellableCount}
              />
            )}
          </div>
        </div>
      </th>
    </tr>
  )
}
