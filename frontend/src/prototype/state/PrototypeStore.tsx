import { useCallback, useMemo, useReducer, type ReactNode } from 'react'
import type { Checkpoint, EvalRun, LineageEdge } from '../data/types'
import { checkpoints as seedCheckpoints } from '../data/checkpoints'
import { lineageEdges as seedLineageEdges } from '../data/lineage'
import { seedRuns } from '../data/runs'
import { useRunSimulation } from './useRunSimulation'
import { PrototypeStoreContext, type PrototypeAction, type PrototypeStoreValue } from './prototypeStoreContext'

interface PrototypeState {
  runs: EvalRun[]
  checkpoints: Checkpoint[]
  lineageEdges: LineageEdge[]
  logsByRunId: Record<string, string[]>
}

// Only used to rebuild state on Reset, deliberately not on first mount:
// the one seeded run left mid-flight (see data/runs.ts) has a queuedAt
// computed relative to module-load time specifically so it looks already
// a bit into its pipeline the first time anyone opens the page. Reset is
// different — a presenter re-running the demo wants to watch the whole
// pipeline unfold from the top, so this restarts it to 'queued' at the
// moment Reset was clicked.
function restartIfNotFinished(run: EvalRun): EvalRun {
  if (run.phase === 'completed' || run.phase === 'failed') return run
  return {
    ...run,
    phase: 'queued',
    queuedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    metrics: [],
    truncationRate: null,
    errorRate: null,
    outputTokensPerSec: null,
    timeToFirstTokenMs: null,
  }
}

function buildInitialState(): PrototypeState {
  return { runs: seedRuns, checkpoints: seedCheckpoints, lineageEdges: seedLineageEdges, logsByRunId: {} }
}

function buildResetState(): PrototypeState {
  return {
    runs: seedRuns.map(restartIfNotFinished),
    checkpoints: seedCheckpoints,
    lineageEdges: seedLineageEdges,
    logsByRunId: {},
  }
}

function prototypeReducer(state: PrototypeState, action: PrototypeAction): PrototypeState {
  switch (action.type) {
    case 'submit_runs':
      // Newest first, so a freshly submitted batch is immediately visible
      // at the top of the Runs page without the presenter needing to scroll.
      return { ...state, runs: [...action.runs, ...state.runs] }

    case 'patch_run':
      return {
        ...state,
        runs: state.runs.map((run) => (run.id === action.runId ? { ...run, ...action.patch } : run)),
      }

    case 'append_log':
      return {
        ...state,
        logsByRunId: {
          ...state.logsByRunId,
          [action.runId]: [...(state.logsByRunId[action.runId] ?? []), action.line],
        },
      }

    // The Model History page's merge flow. Adding the checkpoint and its
    // two incoming edges here (rather than the page holding its own copy)
    // is what makes the new checkpoint "real" everywhere else — the
    // Leaderboard, Submit and Compare pages all read `checkpoints` from
    // this same store.
    case 'merge_checkpoints':
      return {
        ...state,
        checkpoints: [...state.checkpoints, action.checkpoint],
        lineageEdges: [...state.lineageEdges, ...action.edges],
      }

    case 'reset':
      return buildResetState()

    default:
      return state
  }
}

// Provides the in-memory "backend" for the whole vision prototype: every
// run ever submitted during this browser session, plus the timer (see
// useRunSimulation) that carries each one through its phases. Living at
// the provider level rather than inside the Runs page means a run keeps
// advancing even while the presenter is on Submit or Compare.
export function PrototypeStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(prototypeReducer, undefined, buildInitialState)

  useRunSimulation(state.runs, state.checkpoints, dispatch)

  const submitRuns = useCallback((runs: EvalRun[]) => dispatch({ type: 'submit_runs', runs }), [])
  const mergeCheckpoints = useCallback(
    (checkpoint: Checkpoint, edges: LineageEdge[]) => dispatch({ type: 'merge_checkpoints', checkpoint, edges }),
    [],
  )
  const resetDemo = useCallback(() => dispatch({ type: 'reset' }), [])

  const value = useMemo<PrototypeStoreValue>(
    () => ({
      runs: state.runs,
      checkpoints: state.checkpoints,
      lineageEdges: state.lineageEdges,
      logsByRunId: state.logsByRunId,
      submitRuns,
      mergeCheckpoints,
      resetDemo,
    }),
    [state.runs, state.checkpoints, state.lineageEdges, state.logsByRunId, submitRuns, mergeCheckpoints, resetDemo],
  )

  return <PrototypeStoreContext.Provider value={value}>{children}</PrototypeStoreContext.Provider>
}
