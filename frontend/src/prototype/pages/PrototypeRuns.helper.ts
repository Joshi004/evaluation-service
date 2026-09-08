import type { EvalRun } from '../data/types'

// Chosen for the demo, not quoted from the plan docs — the real incident
// this prototype is anchored on was 100% truncation, which crosses any
// reasonable threshold. 5% is a plausible line for "worth a human look".
export const TRUNCATION_FLAG_THRESHOLD = 0.05

export function isTruncationFlagged(run: EvalRun): boolean {
  return run.truncationRate !== null && run.truncationRate > TRUNCATION_FLAG_THRESHOLD
}

export function formatElapsed(run: EvalRun, nowMs: number): string {
  const startMs = new Date(run.queuedAt).getTime()
  const endMs = run.finishedAt ? new Date(run.finishedAt).getTime() : nowMs
  const totalSeconds = Math.max(0, Math.round((endMs - startMs) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function sortRunsByRecency(runs: readonly EvalRun[]): EvalRun[] {
  return runs.slice().sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime())
}
