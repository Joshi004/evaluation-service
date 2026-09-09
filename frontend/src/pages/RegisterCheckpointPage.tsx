import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  apiFetch,
  type CheckpointCandidate,
  type CheckpointDetail,
  type CheckpointInspection,
  type CheckpointListItem,
  type RegisterCheckpointRequest,
  type ServingProfileSummary,
} from '../api/client'
import { CandidateBrowser } from '../components/CandidateBrowser/CandidateBrowser'
import { InspectionSummary } from '../components/InspectionSummary/InspectionSummary'
import { inferredFieldsFromInspection } from '../components/InspectionSummary/InspectionSummary.helper'
import { RegistrationSummary } from '../components/RegistrationSummary/RegistrationSummary'
import { ServingProfilePicker } from '../components/ServingProfilePicker/ServingProfilePicker'
import {
  buildServingProfileSelection,
  defaultServingProfileChoice,
  type ServingProfileChoice,
} from '../components/ServingProfilePicker/ServingProfilePicker.helper'
import {
  buildRegisterRequest,
  canAdvanceFromStep,
  nextWizardStep,
  previousWizardStep,
  WIZARD_STEP_LABELS,
  WIZARD_STEPS,
  type WizardStep,
} from './RegisterCheckpointPage.helper'

const TEXT_INPUT_CLASS_NAME =
  'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200'

// The four-step registration wizard (docs/CHECKPOINT_REGISTRATION_PHASES.md
// Phase 7): browse a candidate, review its inspection, choose a serving
// profile, confirm. Steps live in this component's own state, not the
// router (R-D30) -- a deep link to step 3 has nothing to render without
// step 2's server response. Every hook below is called unconditionally;
// only the JSX branches on `step` (R-T26).
export function RegisterCheckpointPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [step, setStep] = useState<WizardStep>(1)
  const [selectedCandidate, setSelectedCandidate] = useState<CheckpointCandidate | null>(null)
  const [name, setName] = useState('')
  const [family, setFamily] = useState('')
  const [registeredBy, setRegisteredBy] = useState('')
  const [profileChoice, setProfileChoice] = useState<ServingProfileChoice | null>(null)
  const [parentCheckpointId, setParentCheckpointId] = useState<number | null>(null)

  const candidates = useQuery({
    queryKey: ['checkpoint-candidates'],
    queryFn: () => apiFetch<CheckpointCandidate[]>('/checkpoints/candidates'),
  })

  // Keyed on the reference, not the candidate object, so stepping back
  // and reselecting the same candidate reuses the cached inspection
  // instead of re-running several SSH round trips (R-T25).
  const inspection = useQuery({
    queryKey: ['checkpoint-inspection', selectedCandidate?.reference ?? null],
    queryFn: () =>
      apiFetch<CheckpointInspection>('/checkpoints/candidates/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: selectedCandidate?.reference }),
      }),
    enabled: selectedCandidate !== null,
  })

  const servingProfiles = useQuery({
    queryKey: ['serving-profiles'],
    queryFn: () => apiFetch<ServingProfileSummary[]>('/serving-profiles'),
  })

  // Shares the ['checkpoints'] cache with the checkpoints page -- used
  // here for the optional parent-checkpoint select.
  const checkpoints = useQuery({
    queryKey: ['checkpoints'],
    queryFn: () => apiFetch<CheckpointListItem[]>('/checkpoints'),
  })

  const registerMutation = useMutation({
    mutationFn: (request: RegisterCheckpointRequest) =>
      apiFetch<CheckpointDetail>('/checkpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkpoints'] })
      // The just-registered candidate is now already_registered, and a
      // customisation may have minted a profile -- both lists are stale.
      queryClient.invalidateQueries({ queryKey: ['checkpoint-candidates'] })
      queryClient.invalidateQueries({ queryKey: ['serving-profiles'] })
      navigate('/checkpoints')
    },
  })

  const recommendation = inspection.data?.recommendation ?? null
  // `profileChoice` stays null until the user actually touches step 3,
  // so the picker's initial selection is computed on the fly from the
  // recommendation rather than synced into state with an effect.
  const effectiveProfileChoice =
    profileChoice ?? (recommendation ? defaultServingProfileChoice(recommendation) : null)
  const servingProfileSelection =
    effectiveProfileChoice && recommendation
      ? buildServingProfileSelection(effectiveProfileChoice, recommendation)
      : null

  const registerRequest = buildRegisterRequest({
    selectedCandidate,
    name,
    family,
    registeredBy,
    parentCheckpointId,
    servingProfileSelection,
  })

  const canAdvance = canAdvanceFromStep(step, {
    selectedCandidate,
    inspection: inspection.data,
    isInspectionLoading: inspection.isLoading,
    name,
    servingProfileSelection,
    registerRequest,
  })

  const parentCheckpointName =
    checkpoints.data?.find((checkpoint) => checkpoint.id === parentCheckpointId)?.name ?? null

  function handleSelectCandidate(candidate: CheckpointCandidate) {
    setSelectedCandidate(candidate)
    setName(candidate.display_name)
    setFamily('')
    setProfileChoice(null)
    setParentCheckpointId(null)
  }

  function handleRegister() {
    if (registerRequest) {
      registerMutation.mutate(registerRequest)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Register checkpoint</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Browse a candidate on the cluster, review what the service can read about it, choose a
        serving profile, and confirm.
      </p>

      <ol className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {WIZARD_STEPS.map((wizardStep) => (
          <li key={wizardStep} className={wizardStep === step ? 'font-medium text-white' : 'text-slate-500'}>
            {wizardStep}. {WIZARD_STEP_LABELS[wizardStep]}
          </li>
        ))}
      </ol>

      <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        {step === 1 && (
          <CandidateBrowser
            candidates={candidates.data}
            isLoading={candidates.isLoading}
            isError={candidates.isError}
            error={candidates.error}
            selectedReference={selectedCandidate?.reference ?? null}
            onSelect={handleSelectCandidate}
          />
        )}

        {step === 2 && (
          <div>
            {inspection.isLoading && <p className="text-sm text-slate-500">Inspecting…</p>}

            {inspection.isError && (
              <p className="text-sm text-red-400">
                Could not inspect this candidate: {String(inspection.error)}
              </p>
            )}

            {inspection.data && (
              <div className="space-y-4">
                {!inspection.data.readable && (
                  <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    This checkpoint cannot be registered: config.json could not be read.
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-slate-500">Name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={TEXT_INPUT_CLASS_NAME}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Family (optional)</span>
                    <input
                      type="text"
                      value={family}
                      onChange={(event) => setFamily(event.target.value)}
                      className={TEXT_INPUT_CLASS_NAME}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-slate-500">Registered by (optional)</span>
                    <input
                      type="text"
                      value={registeredBy}
                      onChange={(event) => setRegisteredBy(event.target.value)}
                      className={TEXT_INPUT_CLASS_NAME}
                    />
                  </label>
                </div>

                <p className="text-xs text-slate-500">
                  Every field below is read-only: the server re-reads the checkpoint at registration,
                  so nothing here can drift from what it actually finds.
                </p>

                <InspectionSummary
                  fields={inferredFieldsFromInspection(inspection.data)}
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
              <p className="text-sm text-red-400">
                No serving profile recommendation is available for this candidate.
              </p>
            )}

            {recommendation && servingProfiles.isLoading && (
              <p className="text-sm text-slate-500">Loading serving profiles…</p>
            )}

            {recommendation && servingProfiles.isError && (
              <p className="text-sm text-red-400">
                Could not load serving profiles: {String(servingProfiles.error)}
              </p>
            )}

            {recommendation && servingProfiles.data && (
              <ServingProfilePicker
                recommendation={recommendation}
                profiles={servingProfiles.data}
                choice={effectiveProfileChoice ?? { kind: 'existing', profileId: null }}
                onChoiceChange={setProfileChoice}
              />
            )}

            <label className="block max-w-sm">
              <span className="text-xs text-slate-500">Parent checkpoint (optional lineage)</span>
              <select
                value={parentCheckpointId ?? ''}
                onChange={(event) =>
                  setParentCheckpointId(event.target.value === '' ? null : Number(event.target.value))
                }
                className={TEXT_INPUT_CLASS_NAME}
              >
                <option value="">No parent</option>
                {checkpoints.data?.map((checkpoint) => (
                  <option key={checkpoint.id} value={checkpoint.id}>
                    {checkpoint.name}
                  </option>
                ))}
              </select>
            </label>
            {checkpoints.isError && (
              <p className="text-xs text-red-400">
                Could not load checkpoints for lineage: {String(checkpoints.error)}
              </p>
            )}
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

      <div className="mt-6 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(previousWizardStep(step))}
            className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Back
          </button>
        )}

        {step < 4 && (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep(nextWizardStep(step))}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Next
          </button>
        )}

        {step === 4 && (
          <button
            type="button"
            disabled={!registerRequest || registerMutation.isPending}
            onClick={handleRegister}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {registerMutation.isPending ? 'Registering…' : 'Register'}
          </button>
        )}

        {registerMutation.isError && <p className="text-sm text-red-400">{String(registerMutation.error)}</p>}
      </div>
    </div>
  )
}
