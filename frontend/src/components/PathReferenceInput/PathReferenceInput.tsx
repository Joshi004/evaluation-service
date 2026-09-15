import { useState } from 'react'
import type { CheckpointCandidate } from '../../api/client'
import { candidateFromPath, pathReferenceError } from './PathReferenceInput.helper'

interface PathReferenceInputProps {
  selectedReference: string | null
  onSelect: (candidate: CheckpointCandidate) => void
}

// The second way into step 1 of the registration wizard, alongside
// CandidateBrowser: paste an absolute path directly rather than pick
// from what the cluster scan found. Discovery only walks
// CLUSTER_MODELS_ROOT (bounded, R-T7) -- a checkpoint living anywhere
// else, e.g. a person's own home directory, has no other way to reach
// this wizard.
export function PathReferenceInput({ selectedReference, onSelect }: PathReferenceInputProps) {
  const [path, setPath] = useState(selectedReference ?? '')

  const error = pathReferenceError(path)
  const candidate = candidateFromPath(path)

  return (
    <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
      <label className="block">
        <span className="text-xs text-slate-500">Or paste an absolute path on the cluster</span>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/home/jihye.back/slm/experiments/.../merged_global_step_810"
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-sm text-slate-200"
          />
          <button
            type="button"
            disabled={candidate === null}
            onClick={() => candidate && onSelect(candidate)}
            className="shrink-0 rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            Use this path
          </button>
        </div>
      </label>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {candidate !== null && candidate.reference === selectedReference && (
        <p className="mt-1 text-xs text-emerald-400">Selected</p>
      )}
    </div>
  )
}
