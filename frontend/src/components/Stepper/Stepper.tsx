import { Check } from 'lucide-react'
import { cn } from '../../utils/cn'
import {
  currentStepIndex,
  stepButtonClassName,
  stepNumberClassName,
  type StepperStep,
} from './Stepper.helper'

export type { StepperStep }

interface StepperProps {
  steps: StepperStep[]
  currentStepKey: string
  // Stepper has no opinion of its own about which steps a caller may
  // jump to -- New evaluation's own rule ("Review is only reachable
  // once both axes are chosen") lives in NewEvaluationWizard, not here,
  // the same separation `isStepReachable` gives any other multi-step
  // flow that reuses this primitive.
  isStepReachable: (stepKey: string) => boolean
  onStepClick: (stepKey: string) => void
  className?: string
}

// A horizontal step indicator for a flow whose steps live in page
// state, not routes (New evaluation's own three-step
// Choose/Settings/Review -- the registration wizard is another
// caller). Reach for `TabNav` instead once each step is its own route:
// that primitive already handles the URL side this one deliberately
// doesn't.
export function Stepper({ steps, currentStepKey, isStepReachable, onStepClick, className }: StepperProps) {
  const activeIndex = currentStepIndex(steps, currentStepKey)

  return (
    <ol className={cn('flex items-center', className)}>
      {steps.map((step, index) => {
        const isCurrent = step.key === currentStepKey
        const isComplete = index < activeIndex
        const reachable = isStepReachable(step.key)
        const toneOptions = { isCurrent, isComplete, reachable }

        return (
          <li key={step.key} className="flex items-center">
            {index > 0 && <span className="mx-3 h-px w-8 bg-border" aria-hidden="true" />}
            <button
              type="button"
              disabled={!reachable}
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => onStepClick(step.key)}
              className={stepButtonClassName(toneOptions)}
            >
              <span className={stepNumberClassName(toneOptions)}>
                {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              </span>
              {step.label}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
