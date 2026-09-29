// Non-DOM logic for Stepper.tsx: which visual state each step's number
// and label take, and where the current step sits in the list (so a
// step before it can be marked complete without the caller tracking
// that itself).
import { cn } from '../../utils/cn'

export interface StepperStep {
  key: string
  label: string
}

export function currentStepIndex(steps: StepperStep[], currentStepKey: string): number {
  return steps.findIndex((step) => step.key === currentStepKey)
}

interface StepToneOptions {
  isCurrent: boolean
  isComplete: boolean
  reachable: boolean
}

// The number/checkmark circle -- current takes the solid brand fill,
// complete takes the soft one (still reads as "done" without
// competing with the current step for attention), and neither takes
// the plain muted fill every other primitive uses for an inactive
// state.
export function stepNumberClassName({ isCurrent, isComplete }: StepToneOptions): string {
  return cn(
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
    isCurrent && 'bg-primary text-primary-foreground',
    !isCurrent && isComplete && 'bg-primary-soft text-primary',
    !isCurrent && !isComplete && 'bg-muted text-muted-foreground',
  )
}

export function stepButtonClassName({ isCurrent, reachable }: StepToneOptions): string {
  return cn(
    'flex items-center gap-2 rounded-md text-sm font-medium disabled:cursor-not-allowed',
    isCurrent ? 'text-foreground' : 'text-muted-foreground',
    reachable && !isCurrent && 'hover:text-foreground',
  )
}
