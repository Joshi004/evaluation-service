import type { RunPhase } from '../../data/types'
import { getStepLabel, getStepOrder, getStepState } from './PhaseProgress.helper'

interface PhaseProgressProps {
  currentPhase: RunPhase
  includeStaging: boolean
}

const STEP_STATE_CLASSES: Record<'done' | 'active' | 'upcoming', string> = {
  done: 'bg-emerald-500',
  active: 'bg-sky-400 animate-pulse',
  upcoming: 'bg-slate-700',
}

// A run's queued -> staging? -> waiting_endpoint -> inference -> scoring
// -> completed pipeline (EVAL_SERVICE_PLAN.md Section 10, "How a run
// actually moves"), shown as a small stepper. `failed` bypasses the
// stepper — this fixture set doesn't track which specific step a run
// failed at, only that it did.
export function PhaseProgress({ currentPhase, includeStaging }: PhaseProgressProps) {
  if (currentPhase === 'failed') {
    return <span className="text-xs font-medium text-red-400">Failed</span>
  }

  const order = getStepOrder(includeStaging)

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        {order.map((step) => (
          <span
            key={step}
            title={getStepLabel(step)}
            className={`h-1.5 w-6 rounded-full ${STEP_STATE_CLASSES[getStepState(step, currentPhase, order)]}`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400">{getStepLabel(currentPhase)}</span>
    </div>
  )
}
