import type { ServingProfileRecommendation, ServingProfileSummary } from '../../api/client'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'
import { describeProfileGlance } from '../../utils/servingProfileSummary'
import { SelectField } from '../SelectField/SelectField'
import { TextInput } from '../TextInput/TextInput'
import {
  draftFromProfile,
  resolveSelectedProfile,
  type ServingProfileChoice,
  type ServingProfileDraft,
} from './ServingProfilePicker.helper'

interface ServingProfilePickerProps {
  recommendation: ServingProfileRecommendation
  profiles: ServingProfileSummary[]
  choice: ServingProfileChoice
  onChoiceChange: (choice: ServingProfileChoice) => void
}

interface DraftFieldProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  type?: 'text' | 'number'
  step?: string
  placeholder?: string
}

// One customisation field. Local to this component: nothing else
// renders a bare labelled input this way -- mirrors OverrideField.tsx's
// own fields for the same reason.
function DraftField({ label, value, onValueChange, type = 'text', step, placeholder }: DraftFieldProps) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <TextInput
        type={type}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="mt-1 w-full"
      />
    </label>
  )
}

// Step 3 of the registration wizard: accept the recommendation, pick a
// different existing profile, or customise. Whichever is active, the
// component reports a complete ServingProfileChoice to the parent
// rather than owning any of this state itself (the controlled-input
// idiom) -- the parent is what assembles the final
// RegisterCheckpointRequest.
export function ServingProfilePicker({ recommendation, profiles, choice, onChoiceChange }: ServingProfilePickerProps) {
  const effectiveProfile = resolveSelectedProfile(choice, recommendation, profiles)

  function switchToCustomised() {
    onChoiceChange({ kind: 'customised', draft: draftFromProfile(effectiveProfile) })
  }

  function updateDraft(draft: ServingProfileDraft, patch: Partial<ServingProfileDraft>) {
    onChoiceChange({ kind: 'customised', draft: { ...draft, ...patch } })
  }

  const draft = choice.kind === 'customised' ? choice.draft : null

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted p-3">
        <p className="text-xs text-muted-foreground">Recommendation</p>
        <p className="mt-1 text-sm text-foreground">{recommendation.reason}</p>
      </div>

      <label className="flex items-start gap-2">
        <input
          type="radio"
          name="serving-profile-choice"
          className="mt-1"
          checked={choice.kind === 'recommended'}
          disabled={recommendation.profile === null}
          onChange={() => onChoiceChange({ kind: 'recommended' })}
        />
        <span className="text-sm text-foreground">
          Accept the recommendation
          {recommendation.profile && (
            <span className="block text-xs text-muted-foreground">{describeProfileGlance(recommendation.profile)}</span>
          )}
          {!recommendation.profile && <span className="block text-xs text-subtle-foreground">No profile is recommended</span>}
        </span>
      </label>

      <label className="flex items-start gap-2">
        <input
          type="radio"
          name="serving-profile-choice"
          className="mt-1"
          checked={choice.kind === 'existing'}
          onChange={() => onChoiceChange({ kind: 'existing', profileId: null })}
        />
        <span className="w-full text-sm text-foreground">
          Pick an existing profile
          <SelectField
            value={choice.kind === 'existing' && choice.profileId !== null ? choice.profileId : ''}
            disabled={choice.kind !== 'existing'}
            onChange={(event) =>
              onChoiceChange({
                kind: 'existing',
                profileId: event.target.value === '' ? null : Number(event.target.value),
              })
            }
            className="mt-1"
          >
            <option value="">Select a profile…</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {servingProfileDisplayName(profile.label, profile.hash)}
              </option>
            ))}
          </SelectField>
        </span>
      </label>

      <label className="flex items-start gap-2">
        <input
          type="radio"
          name="serving-profile-choice"
          className="mt-1"
          checked={choice.kind === 'customised'}
          onChange={switchToCustomised}
        />
        <span className="text-sm text-foreground">
          Customise
          <span className="block text-xs text-muted-foreground">
            An identical configuration reuses the matching existing profile; a changed one creates a new one.
          </span>
        </span>
      </label>

      {draft && (
        <div className="ml-6 grid grid-cols-2 gap-3 rounded-md border border-border bg-muted p-3 sm:grid-cols-3">
          <DraftField label="Engine" value={draft.engine} onValueChange={(value) => updateDraft(draft, { engine: value })} />
          <DraftField
            label="Engine version"
            value={draft.engine_version}
            onValueChange={(value) => updateDraft(draft, { engine_version: value })}
            placeholder="e.g. 0.19.0"
          />
          <DraftField
            label="GPUs"
            type="number"
            step="1"
            value={draft.gpus}
            onValueChange={(value) => updateDraft(draft, { gpus: value })}
          />
          <DraftField
            label="Tensor parallel size"
            type="number"
            step="1"
            value={draft.tensor_parallel_size}
            onValueChange={(value) => updateDraft(draft, { tensor_parallel_size: value })}
          />
          <DraftField
            label="Pipeline parallel size"
            type="number"
            step="1"
            value={draft.pipeline_parallel_size}
            onValueChange={(value) => updateDraft(draft, { pipeline_parallel_size: value })}
          />
          <DraftField
            label="Max model length"
            type="number"
            step="1"
            placeholder="unset"
            value={draft.max_model_len}
            onValueChange={(value) => updateDraft(draft, { max_model_len: value })}
          />
          <DraftField
            label="Reasoning parser"
            placeholder="none"
            value={draft.reasoning_parser}
            onValueChange={(value) => updateDraft(draft, { reasoning_parser: value })}
          />
          <DraftField label="Dtype" value={draft.dtype} onValueChange={(value) => updateDraft(draft, { dtype: value })} />
          <DraftField
            label="Quantization"
            placeholder="none"
            value={draft.quantization}
            onValueChange={(value) => updateDraft(draft, { quantization: value })}
          />
          <DraftField
            label="GPU memory utilization"
            type="number"
            step="0.01"
            value={draft.gpu_memory_utilization}
            onValueChange={(value) => updateDraft(draft, { gpu_memory_utilization: value })}
          />
          {Object.keys(draft.engine_options).length > 0 && (
            <p className="col-span-full text-xs text-subtle-foreground">
              {Object.keys(draft.engine_options).length} additional engine option
              {Object.keys(draft.engine_options).length === 1 ? '' : 's'} carried over unchanged (not editable here).
            </p>
          )}
        </div>
      )}
    </div>
  )
}
