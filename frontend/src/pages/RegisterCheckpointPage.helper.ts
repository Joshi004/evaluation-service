// Non-DOM logic for RegisterCheckpointPage.tsx: the step sequence, the
// per-step "can I click Next" gate, and assembling the final
// RegisterCheckpointRequest from the page's scattered useState values.
// Kept here rather than inline so the four-step page itself only holds
// state and JSX (R-T27).
import type {
  CheckpointCandidate,
  CheckpointInspection,
  RegisterCheckpointRequest,
  ServingProfileSelection,
} from '../api/client'

export type WizardStep = 1 | 2 | 3 | 4

export const WIZARD_STEPS: WizardStep[] = [1, 2, 3, 4]

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  1: 'Choose a candidate',
  2: 'Review inspection',
  3: 'Serving profile',
  4: 'Confirm',
}

export function nextWizardStep(step: WizardStep): WizardStep {
  switch (step) {
    case 1:
      return 2
    case 2:
      return 3
    case 3:
      return 4
    default:
      return step
  }
}

export function previousWizardStep(step: WizardStep): WizardStep {
  switch (step) {
    case 2:
      return 1
    case 3:
      return 2
    case 4:
      return 3
    default:
      return step
  }
}

export interface WizardStepContext {
  selectedCandidate: CheckpointCandidate | null
  inspection: CheckpointInspection | undefined
  isInspectionLoading: boolean
  name: string
  servingProfileSelection: ServingProfileSelection | null
  registerRequest: RegisterCheckpointRequest | null
}

// Whether "Next" (or, at step 4, "Register") may be clicked. Reads only
// from already-fetched query data and current form state -- no I/O --
// so the page can call it on every render without a fetch of its own.
export function canAdvanceFromStep(step: WizardStep, context: WizardStepContext): boolean {
  if (step === 1) {
    return context.selectedCandidate !== null
  }
  if (step === 2) {
    // Blocking Next on `readable` here, not just at the final POST,
    // means an unreadable candidate is caught right next to the
    // `problems` list that explains why, rather than several steps
    // later as a 400 the user can no longer see the cause of.
    return (
      !context.isInspectionLoading &&
      context.inspection !== undefined &&
      context.inspection.readable &&
      context.name.trim() !== ''
    )
  }
  if (step === 3) {
    return context.servingProfileSelection !== null
  }
  return context.registerRequest !== null
}

export interface RegisterRequestContext {
  selectedCandidate: CheckpointCandidate | null
  name: string
  family: string
  registeredBy: string
  parentCheckpointId: number | null
  servingProfileSelection: ServingProfileSelection | null
}

// Returns null until every required piece is in place -- the single
// place that decides a request is ready, used both to gate the
// Register button and to render RegistrationSummary, so the two can
// never disagree about what is about to be submitted.
export function buildRegisterRequest(context: RegisterRequestContext): RegisterCheckpointRequest | null {
  const trimmedName = context.name.trim()
  if (context.selectedCandidate === null || trimmedName === '' || context.servingProfileSelection === null) {
    return null
  }

  const trimmedFamily = context.family.trim()
  const trimmedRegisteredBy = context.registeredBy.trim()

  return {
    reference: context.selectedCandidate.reference,
    name: trimmedName,
    family: trimmedFamily === '' ? null : trimmedFamily,
    parent_checkpoint_id: context.parentCheckpointId,
    serving_profile: context.servingProfileSelection,
    registered_by: trimmedRegisteredBy === '' ? null : trimmedRegisteredBy,
  }
}
