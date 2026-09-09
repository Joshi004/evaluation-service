import { useState } from 'react'
import { Link } from 'react-router'
import type { CheckpointCandidate } from '../../api/client'
import { EmptyState } from '../EmptyState/EmptyState'
import { filterCandidates } from './CandidateBrowser.helper'

interface CandidateBrowserProps {
  candidates: CheckpointCandidate[] | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  selectedReference: string | null
  onSelect: (candidate: CheckpointCandidate) => void
}

// Step 1 of the registration wizard: browse cluster directories that
// look evaluable. Already-registered candidates stay in the list,
// disabled, rather than being hidden -- hiding them would turn "why
// isn't mine in the list" into a support question.
export function CandidateBrowser({
  candidates,
  isLoading,
  isError,
  error,
  selectedReference,
  onSelect,
}: CandidateBrowserProps) {
  const [filterText, setFilterText] = useState('')

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading candidates…</p>
  }

  if (isError) {
    return <p className="text-sm text-red-400">Could not load candidates: {String(error)}</p>
  }

  const filteredCandidates = filterCandidates(candidates ?? [], filterText)

  return (
    <div>
      <input
        type="text"
        value={filterText}
        onChange={(event) => setFilterText(event.target.value)}
        placeholder="Filter by name or path…"
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
      />

      {filteredCandidates.length === 0 && (
        <div className="mt-4">
          <EmptyState
            message={
              candidates && candidates.length > 0
                ? 'No candidates match this filter'
                : 'No candidates found on the cluster'
            }
          />
        </div>
      )}

      {filteredCandidates.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-800 rounded border border-slate-800">
          {filteredCandidates.map((candidate) => (
            <li key={candidate.reference}>
              {candidate.already_registered ? (
                <div className="flex items-center justify-between gap-4 p-3 text-sm text-slate-500">
                  <div>
                    <p>{candidate.display_name}</p>
                    <p className="font-mono text-xs text-slate-600">{candidate.reference}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs">Already registered</span>
                    <Link to="/checkpoints" className="text-xs text-slate-400 hover:text-slate-200">
                      View checkpoints
                    </Link>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(candidate)}
                  className={
                    candidate.reference === selectedReference
                      ? 'w-full bg-slate-800 p-3 text-left text-sm text-slate-100'
                      : 'w-full p-3 text-left text-sm text-slate-200 hover:bg-slate-800/50'
                  }
                >
                  <p>{candidate.display_name}</p>
                  <p className="font-mono text-xs text-slate-500">{candidate.reference}</p>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
