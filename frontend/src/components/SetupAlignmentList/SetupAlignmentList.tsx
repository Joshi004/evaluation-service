import type { UseQueryResult } from '@tanstack/react-query'
import type { LeaderboardRow, RunPreview, SamplingProfileSummary } from '../../api/client'
import { SetupChip } from '../SetupChip/SetupChip'
import { Skeleton } from '../Skeleton/Skeleton'
import { Spinner } from '../Spinner/Spinner'
import { cn } from '../../utils/cn'
import { buildSetupAlignmentRows } from './SetupAlignmentList.helper'

interface SetupAlignmentListProps {
  preview: RunPreview | undefined
  // Dims the list rather than replacing it with a skeleton -- a
  // debounced keystroke settling shouldn't blank out the previous
  // answer (the same `keepPreviousData` reasoning useRunPreview
  // documents).
  isPreviewFetching: boolean
  samplingProfiles: SamplingProfileSummary[]
  leaderboardQuery: UseQueryResult<LeaderboardRow[]>
}

// Per (model, benchmark) pair, "will this line up with the
// leaderboard?" -- computed from the live preview's `comparison_hash`
// against the known leaderboard hashes rather than guessing from the
// sampling profile choice alone.
export function SetupAlignmentList({ preview, isPreviewFetching, samplingProfiles, leaderboardQuery }: SetupAlignmentListProps) {
  if (!preview || preview.pairs.length === 0) {
    return null
  }

  if (leaderboardQuery.isError) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t check existing results.</p>
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Will this line up with the leaderboard?</h3>
        {isPreviewFetching && <Spinner label="Checking" className="h-3 w-3 text-muted-foreground" />}
      </div>
      {leaderboardQuery.isLoading ? (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : (
        <ul className={cn('mt-2 space-y-2', isPreviewFetching && 'opacity-60')}>
          {buildSetupAlignmentRows(preview, leaderboardQuery.data ?? [], samplingProfiles).map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-foreground">
                {row.checkpointName} × {row.benchmarkLabel}
              </span>
              <SetupChip samplingProfileLabel={row.samplingProfileLabel} samplingProfileHash={row.samplingProfileHash} />
              <span className={row.existingResultCount > 0 ? 'text-success' : 'text-muted-foreground'}>
                {row.existingResultCount > 0
                  ? `Same setup as ${row.existingResultCount} existing result${row.existingResultCount === 1 ? '' : 's'}`
                  : 'New setup, not comparable with existing results'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
