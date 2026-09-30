import { useState } from 'react'
import type { CheckpointCandidate } from '../../api/client'
import { Button } from '../Button/Button'
import { TextInput } from '../TextInput/TextInput'
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
    <div className="rounded-md border border-border bg-card p-3">
      <label className="block">
        <span className="text-xs text-muted-foreground">Or paste an absolute path on the cluster</span>
        <div className="mt-1 flex gap-2">
          <TextInput
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/home/jihye.back/slm/experiments/.../merged_global_step_810"
            className="w-full font-mono"
            invalid={error !== null}
          />
          <Button size="sm" className="shrink-0" disabled={candidate === null} onClick={() => candidate && onSelect(candidate)}>
            Use this path
          </Button>
        </div>
      </label>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      {candidate !== null && candidate.reference === selectedReference && (
        <p className="mt-1 text-xs text-success">Selected</p>
      )}
    </div>
  )
}
