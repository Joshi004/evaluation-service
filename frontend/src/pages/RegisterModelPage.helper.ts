// Non-DOM logic for RegisterModelPage.tsx: the step sequence, the
// per-step "can I click Next" gate, assembling the final
// RegisterCheckpointRequest from the page's scattered useState values,
// and describing a failed registration in plain language. Kept here
// rather than inline so the four-step page itself only holds state and
// JSX (R-T27).
import { ApiError } from '../api/client'
import type {
  CheckpointCandidate,
  CheckpointInspection,
  RegisterCheckpointRequest,
  ServingProfileSelection,
} from '../api/client'
import type { StepperStep } from '../components/Stepper/Stepper'

export type WizardStep = 1 | 2 | 3 | 4

export const WIZARD_STEPS: WizardStep[] = [1, 2, 3, 4]

// Stepper's own step shape needs a string key (Phase 11,
// docs/UI_REDESIGN_PLAN.md §8.11) -- the wizard's own step state stays
// the numeric WizardStep everywhere else, converted only at the
// Stepper boundary (String(step) in, Number(key) as WizardStep out).
export const REGISTRATION_STEPS: StepperStep[] = [
  { key: '1', label: 'Choose checkpoint' },
  { key: '2', label: 'Review details' },
  { key: '3', label: 'Serving and lineage' },
  { key: '4', label: 'Confirm' },
]

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
    // Blocking Next on `missing_requirements` here, not just at the
    // final POST, means an unregisterable candidate is caught right
    // next to the list that explains why, rather than several steps
    // later as a 400 the user can no longer see the cause of.
    return (
      !context.isInspectionLoading &&
      context.inspection !== undefined &&
      context.inspection.missing_requirements.length === 0 &&
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

// The Stepper's own reachability rule (docs/UI_REDESIGN_PLAN.md §8.11):
// "earlier steps are always clickable; a later step is clickable only
// when every gate before it passes." Checked from step 1 regardless of
// which step the wizard is currently on -- going back and clearing a
// field that an earlier step's gate depends on (e.g. the name, at step
// 2) must immediately close off any later step again, not just the one
// right after it.
export function isStepReachable(targetStep: WizardStep, currentStep: WizardStep, context: WizardStepContext): boolean {
  if (targetStep <= currentStep) {
    return true
  }
  return WIZARD_STEPS.filter((step) => step < targetStep).every((step) => canAdvanceFromStep(step, context))
}

export interface RegistrationErrorDescription {
  message: string
  detail: string
}

// A plain message per status (docs/UI_REDESIGN_PLAN.md §8.11's own
// "Errors" decision), mirroring register_checkpoint's own
// exception-to-status mapping (backend/app/api/v1/checkpoints.py): 409
// a name/path/lineage conflict, 400 a candidate the server can't serve
// (or a malformed path), 404 a parent or serving profile that no
// longer exists, 503 the cluster is unreachable over SSH. The raw
// `detail` -- the exception's own message, which is already
// specific -- always goes to the caller's ErrorState `details`
// disclosure, so nothing here needs to repeat it.
export function describeRegistrationError(error: unknown): RegistrationErrorDescription {
  const detail = error instanceof Error ? error.message : String(error)
  const status = error instanceof ApiError ? error.status : null

  if (status === 409) {
    return { message: 'Already registered: this name, path or lineage conflicts with an existing model.', detail }
  }
  if (status === 400) {
    return {
      message: "Not servable: the server can't run this checkpoint as-is (missing config, weights or a tokenizer).",
      detail,
    }
  }
  if (status === 404) {
    return { message: 'Missing reference: the chosen parent or serving profile no longer exists.', detail }
  }
  if (status === 503) {
    return { message: 'Cluster unreachable: the server could not reach the cluster over SSH.', detail }
  }
  return { message: 'Could not register this model.', detail }
}
