// eval_run has no phase column (app/models/eval_run.py) -- only status
// plus endpoint_id. This derives the same three in-flight steps a run
// actually walks through -- queued -> starting its model server ->
// evaluating -- before landing on one of three terminal statuses, which
// this treats as "the spine is complete", not a fourth step: which
// terminal outcome it was is RunStatusChip's job, not this stepper's.
//
// The run report's stepper and a Runs row must never derive
// "Starting model server" two different ways.

export type Phase = 'queued' | 'waiting_for_endpoint' | 'evaluating' | 'done' | 'failed' | 'cancelled'

export interface PhaseStep {
  key: Phase
  label: string
}

// The in-flight spine only -- terminal phases never appear as a step
// here, since a finished run has already passed every one of them.
// "Starting model server", not "Waiting for endpoint" -- user-facing
// copy maps `endpoint` to "Model server".
export const PHASE_STEPS: PhaseStep[] = [
  { key: 'queued', label: 'Queued' },
  { key: 'waiting_for_endpoint', label: 'Starting model server' },
  { key: 'evaluating', label: 'Evaluating' },
]

export function derivePhase(status: string, endpointId: number | null): Phase {
  if (status === 'done' || status === 'failed' || status === 'cancelled') {
    return status
  }
  if (status === 'queued') {
    return 'queued'
  }
  // status === 'running': endpoint_id flips from null to set while
  // still 'running' (attach_endpoint happens after mark_running, both
  // before the harness ever starts -- see services/runs/worker.py), so
  // this is what tells "cold start in progress" apart from "harness
  // actually running against a ready endpoint".
  return endpointId !== null ? 'evaluating' : 'waiting_for_endpoint'
}

// Index into PHASE_STEPS the run has reached, or PHASE_STEPS.length for
// any terminal phase (i.e. "past the end" -- every step renders done).
export function stepIndex(phase: Phase): number {
  const index = PHASE_STEPS.findIndex((step) => step.key === phase)
  return index === -1 ? PHASE_STEPS.length : index
}

type PhaseDotTone = 'current' | 'complete' | 'upcoming'

const DOT_TONE_CLASSES: Record<PhaseDotTone, string> = {
  current: 'bg-info',
  complete: 'bg-success',
  upcoming: 'bg-border-strong',
}

export function phaseDotClassName(index: number, currentIndex: number): string {
  const tone: PhaseDotTone = index === currentIndex ? 'current' : index < currentIndex ? 'complete' : 'upcoming'
  return `h-2 w-2 rounded-full ${DOT_TONE_CLASSES[tone]}`
}

// The Runs table's own one-line phase text for a queued/running row --
// reuses derivePhase's status+endpoint_id logic rather than a second
// guess at the same three steps, then reads that step's own label.
// `null` for a terminal run: RunStatusChip's status text is already
// the whole story once a run is done, failed or cancelled.
export function runningPhaseLabel(status: string, endpointId: number | null): string | null {
  const phase = derivePhase(status, endpointId)
  const step = PHASE_STEPS.find((candidate) => candidate.key === phase)
  return step?.label ?? null
}
