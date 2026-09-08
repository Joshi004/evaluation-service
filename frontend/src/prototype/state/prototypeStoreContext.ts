import { createContext } from 'react'
import type { Checkpoint, EvalRun, LineageEdge } from '../data/types'

export type PrototypeAction =
  | { type: 'submit_runs'; runs: EvalRun[] }
  | { type: 'patch_run'; runId: string; patch: Partial<EvalRun> }
  | { type: 'append_log'; runId: string; line: string }
  | { type: 'merge_checkpoints'; checkpoint: Checkpoint; edges: LineageEdge[] }
  | { type: 'reset' }

export interface PrototypeStoreValue {
  runs: EvalRun[]
  checkpoints: Checkpoint[]
  lineageEdges: LineageEdge[]
  logsByRunId: Record<string, string[]>
  submitRuns: (runs: EvalRun[]) => void
  mergeCheckpoints: (checkpoint: Checkpoint, edges: LineageEdge[]) => void
  resetDemo: () => void
}

// Split into its own file (rather than living in PrototypeStore.tsx) so
// that file can export only the Provider component and this one only
// exports the context + its types — keeps Fast Refresh happy and satisfies
// oxlint's react/only-export-components.
export const PrototypeStoreContext = createContext<PrototypeStoreValue | null>(null)
