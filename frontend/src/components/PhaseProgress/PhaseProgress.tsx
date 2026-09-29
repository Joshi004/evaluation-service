import { derivePhase, PHASE_STEPS, phaseDotClassName, stepIndex } from './PhaseProgress.helper'

interface PhaseProgressProps {
  status: string
  endpointId: number | null
}

// A three-step stepper derived from status + endpoint_id
// (PhaseProgress.helper.ts's derivePhase), since eval_run has no phase
// column of its own. A terminal run renders every step complete --
// RunStatusChip is what distinguishes done from failed from cancelled,
// this only shows how far a run got before that.
export function PhaseProgress({ status, endpointId }: PhaseProgressProps) {
  const currentIndex = stepIndex(derivePhase(status, endpointId))

  return (
    <ol className="flex items-center gap-2 text-xs">
      {PHASE_STEPS.map((step, index) => (
        <li key={step.key} className="flex items-center gap-2">
          <span className={phaseDotClassName(index, currentIndex)} />
          <span className={index === currentIndex ? 'text-foreground' : 'text-muted-foreground'}>
            {step.label}
          </span>
          {index < PHASE_STEPS.length - 1 && <span className="text-subtle-foreground">{'\u2192'}</span>}
        </li>
      ))}
    </ol>
  )
}
