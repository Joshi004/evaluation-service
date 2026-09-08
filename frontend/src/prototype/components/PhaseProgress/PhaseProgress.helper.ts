import type { RunPhase } from '../../data/types'

const STEP_ORDER_WITH_STAGING: RunPhase[] = ['queued', 'staging', 'waiting_endpoint', 'inference', 'scoring', 'completed']
const STEP_ORDER_WITHOUT_STAGING: RunPhase[] = ['queued', 'waiting_endpoint', 'inference', 'scoring', 'completed']

const STEP_LABELS: Record<RunPhase, string> = {
  queued: 'Queued',
  staging: 'Staging weights',
  waiting_endpoint: 'Starting endpoint',
  inference: 'Running inference',
  scoring: 'Scoring',
  completed: 'Completed',
  failed: 'Failed',
}

/** A checkpoint already on the cluster skips the staging step entirely — see EVAL_SERVICE_PLAN.md Section 7. */
export function getStepOrder(includeStaging: boolean): RunPhase[] {
  return includeStaging ? STEP_ORDER_WITH_STAGING : STEP_ORDER_WITHOUT_STAGING
}

export function getStepLabel(step: RunPhase): string {
  return STEP_LABELS[step]
}

export type StepState = 'done' | 'active' | 'upcoming'

export function getStepState(step: RunPhase, currentPhase: RunPhase, order: RunPhase[]): StepState {
  const currentIndex = order.indexOf(currentPhase)
  const stepIndex = order.indexOf(step)
  if (stepIndex < currentIndex) return 'done'
  if (stepIndex === currentIndex) return 'active'
  return 'upcoming'
}
