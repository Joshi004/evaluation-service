import { PHASE_STEPS, derivePhase, stepIndex } from './PhaseProgress.helper'

interface PhaseProgressProps {
  status: string
  endpointId: number | null
}

function dotClassName(index: number, currentIndex: number): string {
  if (index === currentIndex) {
    return 'h-2 w-2 rounded-full bg-blue-400'
  }
  if (index < currentIndex) {
    return 'h-2 w-2 rounded-full bg-emerald-400'
  }
  return 'h-2 w-2 rounded-full bg-slate-700'
}

// A three-step stepper derived from status + endpoint_id
// (PhaseProgress.helper.ts's derivePhase), since eval_run has no phase
// column of its own. A terminal run renders every step complete --
// StatusBadge is what distinguishes done from failed from cancelled,
// this only shows how far a run got before that.
export function PhaseProgress({ status, endpointId }: PhaseProgressProps) {
  const currentIndex = stepIndex(derivePhase(status, endpointId))

  return (
    <ol className="flex items-center gap-2 text-xs">
      {PHASE_STEPS.map((step, index) => (
        <li key={step.key} className="flex items-center gap-2">
          <span className={dotClassName(index, currentIndex)} />
          <span className={index === currentIndex ? 'text-slate-200' : 'text-slate-500'}>
            {step.label}
          </span>
          {index < PHASE_STEPS.length - 1 && <span className="text-slate-700">→</span>}
        </li>
      ))}
    </ol>
  )
}
