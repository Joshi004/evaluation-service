import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { CheckpointCandidate } from '../api/client'
import {
  useCheckpointCandidates,
  useCheckpointInspection,
  useCheckpoints,
  useRegisterCheckpoint,
} from '../api/queries/checkpoints'
import { useServingProfiles } from '../api/queries/servingProfiles'
import { describeError } from '../utils/describeError'
import { paths } from '../utils/paths'
import { useRememberedName } from '../utils/useRememberedName'
import { Button } from '../components/Button/Button'
import { CandidateBrowser } from '../components/CandidateBrowser/CandidateBrowser'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { FamilyInput } from '../components/FamilyInput/FamilyInput'
import { InspectionSummary } from '../components/InspectionSummary/InspectionSummary'
import { inferredFieldsFromInspection } from '../components/InspectionSummary/InspectionSummary.helper'
import { ParentModelPicker } from '../components/ParentModelPicker/ParentModelPicker'
import { PathReferenceInput } from '../components/PathReferenceInput/PathReferenceInput'
import { RegistrationSummary } from '../components/RegistrationSummary/RegistrationSummary'
import { ServingProfilePicker } from '../components/ServingProfilePicker/ServingProfilePicker'
import {
  buildServingProfileSelection,
  defaultServingProfileChoice,
  type ServingProfileChoice,
} from '../components/ServingProfilePicker/ServingProfilePicker.helper'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { Spinner } from '../components/Spinner/Spinner'
import { Stepper } from '../components/Stepper/Stepper'
import { TextInput } from '../components/TextInput/TextInput'
import {
  buildRegisterRequest,
  canAdvanceFromStep,
  describeRegistrationError,
  isStepReachable,
  nextWizardStep,
  previousWizardStep,
  REGISTRATION_STEPS,
  type WizardStep,
  type WizardStepContext,
} from './RegisterModelPage.helper'

// The four-step registration wizard: browse a candidate, review its
// inspection, choose a serving profile and lineage, confirm. Steps
// live in this component's own state, not the router -- a deep link
// to step 3 has nothing to render without step 2's server response.
// Every hook below is called unconditionally; only the JSX branches
// on `step` (R-T26).
export function RegisterModelPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<WizardStep>(1)
  const [selectedCandidate, setSelectedCandidate] = useState<CheckpointCandidate | null>(null)
  const [name, setName] = useState('')
  const [family, setFamily] = useState('')
  const [registeredBy, setRegisteredBy] = useRememberedName()
  const [profileChoice, setProfileChoice] = useState<ServingProfileChoice | null>(null)
  const [parentCheckpointId, setParentCheckpointId] = useState<number | null>(null)

  const candidates = useCheckpointCandidates()

  // Keyed on the reference, not the candidate object, so stepping back
  // and reselecting the same candidate reuses the cached inspection
  // instead of re-running several SSH round trips (R-T25).
  const inspection = useCheckpointInspection(selectedCandidate?.reference ?? null)

  const servingProfiles = useServingProfiles()

  // Shares the checkpoints cache with the Models page -- used here for
  // the optional parent-model picker.
  const checkpoints = useCheckpoints()

  const registerMutation = useRegisterCheckpoint()

  const recommendation = inspection.data?.recommendation ?? null
  // `profileChoice` stays null until the user actually touches step 3,
  // so the picker's initial selection is computed on the fly from the
  // recommendation rather than synced into state with an effect.
  const effectiveProfileChoice = profileChoice ?? (recommendation ? defaultServingProfileChoice(recommendation) : null)
  const servingProfileSelection =
    effectiveProfileChoice && recommendation ? buildServingProfileSelection(effectiveProfileChoice, recommendation) : null

  const registerRequest = buildRegisterRequest({
    selectedCandidate,
    name,
    family,
    registeredBy,
    parentCheckpointId,
    servingProfileSelection,
  })

  const stepContext: WizardStepContext = {
    selectedCandidate,
    inspection: inspection.data,
    isInspectionLoading: inspection.isLoading,
    name,
    servingProfileSelection,
    registerRequest,
  }
  const canAdvance = canAdvanceFromStep(step, stepContext)

  const parentCheckpointName = checkpoints.data?.find((checkpoint) => checkpoint.id === parentCheckpointId)?.name ?? null

  const registrationError = registerMutation.isError ? describeRegistrationError(registerMutation.error) : null

  function handleSelectCandidate(candidate: CheckpointCandidate) {
    setSelectedCandidate(candidate)
    setName(candidate.display_name)
    setFamily('')
    setProfileChoice(null)
    setParentCheckpointId(null)
  }

  function handleRegister(): void {
    if (!registerRequest) {
      return
    }
    registerMutation.mutate(registerRequest, {
      onSuccess: (registeredCheckpoint) => {
        toast.success(`Registered ${registeredCheckpoint.name}`)
        navigate(paths.model(registeredCheckpoint.id))
      },
      onError: (error) => {
        toast.error(describeRegistrationError(error).message)
      },
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Register a model</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Browse a candidate on the cluster or paste its absolute path, review what the service can read about it,
        choose a serving profile and lineage, and confirm.
      </p>

      <Stepper
        steps={REGISTRATION_STEPS}
        currentStepKey={String(step)}
        isStepReachable={(stepKey) => isStepReachable(Number(stepKey) as WizardStep, step, stepContext)}
        onStepClick={(stepKey) => setStep(Number(stepKey) as WizardStep)}
        className="mt-6"
      />

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        {step === 1 && (
          <div className="space-y-4">
            <PathReferenceInput selectedReference={selectedCandidate?.reference ?? null} onSelect={handleSelectCandidate} />
            <CandidateBrowser
              candidates={candidates.data}
              hasBrowsed={candidates.isFetched}
              isLoading={candidates.isFetching}
              isError={candidates.isError}
              error={candidates.error}
              selectedReference={selectedCandidate?.reference ?? null}
              onSelect={handleSelectCandidate}
              onBrowse={() => candidates.refetch()}
            />
          </div>
        )}

        {step === 2 && (
          <div>
            {inspection.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Reading the checkpoint on the cluster…
              </div>
            )}

            {!inspection.isLoading && inspection.isError && (
              <ErrorState
                message="Could not inspect this candidate."
                details={String(inspection.error)}
                onRetry={() => inspection.refetch()}
              />
            )}

            {!inspection.isLoading && inspection.data && (
              <div className="space-y-4">
                {selectedCandidate && inspection.data.reference !== selectedCandidate.reference && (
                  <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
                    This path resolved to <span className="font-mono text-foreground">{inspection.data.reference}</span>.
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Name</span>
                    <TextInput value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full" />
                  </label>
                  <FamilyInput value={family} onChange={setFamily} checkpoints={checkpoints.data ?? []} />
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-muted-foreground">Registered by (optional)</span>
                    <TextInput
                      value={registeredBy}
                      onChange={(event) => setRegisteredBy(event.target.value)}
                      className="mt-1 w-full"
                    />
                  </label>
                </div>

                <p className="text-xs text-muted-foreground">
                  Every field below is read-only: the server re-reads the checkpoint at registration, so nothing here
                  can drift from what it actually finds.
                </p>

                <InspectionSummary
                  fields={inferredFieldsFromInspection(inspection.data)}
                  missingRequirements={inspection.data.missing_requirements}
                  problems={inspection.data.problems}
                  sourceConfig={inspection.data.source_config}
                />
              </div>
            )}
          </div>
        )}

        {step === 3 && inspection.data && (
          <div className="space-y-6">
            {!recommendation && (
              <p className="text-sm text-danger">No serving profile recommendation is available for this candidate.</p>
            )}

            {recommendation && servingProfiles.isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-5 w-40" />
              </div>
            )}

            {recommendation && servingProfiles.isError && (
              <ErrorState
                message="Could not load serving profiles."
                details={String(servingProfiles.error)}
                onRetry={() => servingProfiles.refetch()}
              />
            )}

            {recommendation && servingProfiles.data && (
              <ServingProfilePicker
                recommendation={recommendation}
                profiles={servingProfiles.data}
                choice={effectiveProfileChoice ?? { kind: 'existing', profileId: null }}
                onChoiceChange={setProfileChoice}
              />
            )}

            <div>
              <p className="text-sm font-medium text-foreground">Parent checkpoint (optional lineage)</p>
              <div className="mt-2">
                <ParentModelPicker
                  checkpoints={checkpoints.data ?? []}
                  selectedParentId={parentCheckpointId}
                  onSelectedParentIdChange={setParentCheckpointId}
                />
              </div>
              {checkpoints.isError && (
                <p className="mt-1 text-xs text-danger">
                  Could not load checkpoints for lineage: {describeError(checkpoints.error)}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 4 && registerRequest && selectedCandidate && (
          <RegistrationSummary
            request={registerRequest}
            candidateDisplayName={selectedCandidate.display_name}
            profiles={servingProfiles.data ?? []}
            parentCheckpointName={parentCheckpointName}
          />
        )}
      </section>

      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep(previousWizardStep(step))}>
              Back
            </Button>
          )}

          {step < 4 && (
            <Button disabled={!canAdvance} onClick={() => setStep(nextWizardStep(step))}>
              Next
            </Button>
          )}

          {step === 4 && (
            <Button disabled={!registerRequest || registerMutation.isPending} loading={registerMutation.isPending} onClick={handleRegister}>
              Register
            </Button>
          )}
        </div>

        {registrationError && (
          <ErrorState message={registrationError.message} details={registrationError.detail} onRetry={handleRegister} />
        )}
      </div>
    </div>
  )
}
