import type { RunPhase } from '../../data/types'

export type StatusTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info'

export function toneClasses(tone: StatusTone): string {
  switch (tone) {
    case 'positive':
      return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
    case 'warning':
      return 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
    case 'danger':
      return 'bg-red-500/10 text-red-300 border border-red-500/20'
    case 'info':
      return 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
    default:
      return 'bg-slate-800 text-slate-300 border border-slate-700'
  }
}

const PHASE_LABELS: Record<RunPhase, string> = {
  queued: 'Queued',
  staging: 'Staging',
  waiting_endpoint: 'Starting endpoint',
  inference: 'Running',
  scoring: 'Scoring',
  completed: 'Completed',
  failed: 'Failed',
}

const PHASE_TONES: Record<RunPhase, StatusTone> = {
  queued: 'neutral',
  staging: 'info',
  waiting_endpoint: 'info',
  inference: 'info',
  scoring: 'info',
  completed: 'positive',
  failed: 'danger',
}

export function phaseToLabel(phase: RunPhase): string {
  return PHASE_LABELS[phase]
}

export function phaseToTone(phase: RunPhase): StatusTone {
  return PHASE_TONES[phase]
}
