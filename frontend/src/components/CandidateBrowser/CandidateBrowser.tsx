import { useState } from 'react'
import { Link } from 'react-router'
import type { CheckpointCandidate } from '../../api/client'
import { paths } from '../../utils/paths'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import { EmptyState } from '../EmptyState/EmptyState'
import { ErrorState } from '../ErrorState/ErrorState'
import { SearchInput } from '../SearchInput/SearchInput'
import { Skeleton } from '../Skeleton/Skeleton'
import { filterCandidates } from './CandidateBrowser.helper'

interface CandidateBrowserProps {
  candidates: CheckpointCandidate[] | undefined
  // True once a browse (or refresh) attempt has settled, success or
  // error -- distinguishes "never asked the cluster" from "asked, and
  // it has nothing" (Phase 11, docs/UI_REDESIGN_PLAN.md §8.11's own
  // "reads run only on user action" decision: this never happens on
  // mount, so the not-yet-browsed state below is the normal start).
  hasBrowsed: boolean
  isLoading: boolean
  isError: boolean
  error: unknown
  selectedReference: string | null
  onSelect: (candidate: CheckpointCandidate) => void
  onBrowse: () => void
}

// Step 1 of the registration wizard: browse cluster directories that
// look evaluable. Already-registered candidates stay in the list,
// disabled, rather than being hidden -- hiding them would turn "why
// isn't mine in the list" into a support question. Owns the "Browse
// the cluster" / "Refresh" trigger itself, since it is inseparable
// from the loading and error states right below it.
export function CandidateBrowser({
  candidates,
  hasBrowsed,
  isLoading,
  isError,
  error,
  selectedReference,
  onSelect,
  onBrowse,
}: CandidateBrowserProps) {
  const [filterText, setFilterText] = useState('')
  const filteredCandidates = filterCandidates(candidates ?? [], filterText)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Browse the cluster</p>
        <Button variant="secondary" size="sm" onClick={onBrowse} disabled={isLoading}>
          {hasBrowsed ? 'Refresh' : 'Browse the cluster'}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!isLoading && isError && (
        <ErrorState message="Could not load candidates from the cluster." details={String(error)} onRetry={onBrowse} />
      )}

      {!isLoading && !isError && !hasBrowsed && (
        <EmptyState
          title="Not browsed yet"
          description="Click Browse the cluster above to list evaluable directories, or paste an absolute path below."
        />
      )}

      {!isLoading && !isError && hasBrowsed && (
        <>
          <SearchInput
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            onClear={() => setFilterText('')}
            placeholder="Filter by name or path…"
            aria-label="Filter candidates"
          />

          {filteredCandidates.length === 0 &&
            (candidates && candidates.length > 0 ? (
              <EmptyState
                title="No candidates match"
                description="Try a different search."
                actions={
                  <Button variant="secondary" size="sm" onClick={() => setFilterText('')}>
                    Clear filter
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No candidates found"
                description="Nothing evaluable was found on the cluster. Try a different path, or paste an absolute path below."
              />
            ))}

          {filteredCandidates.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {filteredCandidates.map((candidate) => (
                <li key={candidate.reference}>
                  {candidate.already_registered ? (
                    <div className="flex items-center justify-between gap-4 p-3 text-sm text-muted-foreground">
                      <div>
                        <p>{candidate.display_name}</p>
                        <p className="font-mono text-xs text-subtle-foreground">{candidate.reference}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge tone="neutral">Already registered</Badge>
                        <Link to={paths.models()} className="text-xs text-muted-foreground hover:text-foreground">
                          View models
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(candidate)}
                      className={
                        candidate.reference === selectedReference
                          ? 'w-full bg-muted p-3 text-left text-sm text-foreground'
                          : 'w-full p-3 text-left text-sm text-foreground hover:bg-muted/50'
                      }
                    >
                      <p>{candidate.display_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{candidate.reference}</p>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
