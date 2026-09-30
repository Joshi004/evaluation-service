import type { CheckpointListItem, SamplingProfileSummary, StandardSummary } from '../../api/client'
import { LabelOverrideField, NumberOverrideField, SelectOverrideField } from '../OverrideField/OverrideField'
import { SelectField } from '../SelectField/SelectField'
import { Skeleton } from '../Skeleton/Skeleton'
import {
  samplingOverrideDraftHasChange,
  type SamplingOverrideDraft,
} from '../SubmitOverrides/SubmitOverrides.helper'
import {
  defaultProfileOptionLabel,
  resolveBaseSamplingProfile,
  samplingMandateNotesByField,
  samplingProfileOptionLabel,
  samplingProfileOptions,
} from './CheckpointSamplingCard.helper'

interface CheckpointSamplingCardProps {
  checkpoint: CheckpointListItem
  samplingProfiles: SamplingProfileSummary[]
  samplingProfilesById: Map<number, SamplingProfileSummary>
  selectedStandards: StandardSummary[]
  // null = "use this checkpoint's own registered default" (the same
  // fallback, narrowed here to one checkpoint instead of the whole
  // grid).
  profileChoice: number | null
  onProfileChoiceChange: (choice: number | null) => void
  draft: SamplingOverrideDraft
  onDraftChange: (draft: SamplingOverrideDraft) => void
  // Already resolved by SubmitOverrides.tsx -- whatever this card's own
  // label draft holds, or else a computed suggestion. See
  // SubmitOverrides.helper.ts's resolveSamplingLabels.
  labelValue: string
  onLabelChange: (label: string) => void
}

const ENABLE_THINKING_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

// One selected checkpoint's sampling: which base profile it starts
// from (its own registered default, or one picked here) plus the eight
// SamplingOverrides fields, each defaulting to that base profile's own
// value. Picking a different base profile updates every field's
// placeholder at once. Rendered inside its Settings row's own
// "Customize" side panel -- the checkpoint's own name is the panel's
// title, not repeated here.
export function CheckpointSamplingCard({
  checkpoint,
  samplingProfiles,
  samplingProfilesById,
  selectedStandards,
  profileChoice,
  onProfileChoiceChange,
  draft,
  onDraftChange,
  labelValue,
  onLabelChange,
}: CheckpointSamplingCardProps) {
  const baseProfile = resolveBaseSamplingProfile(checkpoint, profileChoice, samplingProfilesById)
  const mandateNotesByField = samplingMandateNotesByField(selectedStandards)
  const options = samplingProfileOptions(profileChoice, samplingProfiles, samplingProfilesById)
  const hasChange = samplingOverrideDraftHasChange(draft)

  return (
    <div>
      <label className="block">
        <span className="text-xs text-muted-foreground">Base sampling profile</span>
        <SelectField
          value={profileChoice ?? ''}
          onChange={(event) =>
            onProfileChoiceChange(event.target.value === '' ? null : Number(event.target.value))
          }
          className="mt-1"
        >
          <option value="">{defaultProfileOptionLabel(checkpoint)}</option>
          {options.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {samplingProfileOptionLabel(profile)}
            </option>
          ))}
        </SelectField>
      </label>

      {baseProfile ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumberOverrideField
              label="Temperature"
              step="0.01"
              defaultValue={String(baseProfile.temperature)}
              value={draft.temperature}
              onValueChange={(value) => onDraftChange({ ...draft, temperature: value })}
              note={mandateNotesByField.get('temperature')}
            />
            <NumberOverrideField
              label="Top-p"
              step="0.01"
              defaultValue={String(baseProfile.top_p)}
              value={draft.top_p}
              onValueChange={(value) => onDraftChange({ ...draft, top_p: value })}
              note={mandateNotesByField.get('top_p')}
            />
            <NumberOverrideField
              label="Top-k"
              step="1"
              defaultValue={String(baseProfile.top_k)}
              value={draft.top_k}
              onValueChange={(value) => onDraftChange({ ...draft, top_k: value })}
              note={mandateNotesByField.get('top_k')}
            />
            <NumberOverrideField
              label="Min-p"
              step="0.01"
              defaultValue={String(baseProfile.min_p)}
              value={draft.min_p}
              onValueChange={(value) => onDraftChange({ ...draft, min_p: value })}
              note={mandateNotesByField.get('min_p')}
            />
            <NumberOverrideField
              label="Presence penalty"
              step="0.01"
              defaultValue={String(baseProfile.presence_penalty)}
              value={draft.presence_penalty}
              onValueChange={(value) => onDraftChange({ ...draft, presence_penalty: value })}
              note={mandateNotesByField.get('presence_penalty')}
            />
            <NumberOverrideField
              label="Repetition penalty"
              step="0.01"
              defaultValue={String(baseProfile.repetition_penalty)}
              value={draft.repetition_penalty}
              onValueChange={(value) => onDraftChange({ ...draft, repetition_penalty: value })}
              note={mandateNotesByField.get('repetition_penalty')}
            />
            <NumberOverrideField
              label="Max tokens"
              step="1"
              defaultValue={String(baseProfile.max_tokens)}
              value={draft.max_tokens}
              onValueChange={(value) => onDraftChange({ ...draft, max_tokens: value })}
              note={mandateNotesByField.get('max_tokens')}
            />
            <SelectOverrideField
              label="Enable thinking"
              options={ENABLE_THINKING_OPTIONS}
              defaultOptionLabel={`Default (${baseProfile.enable_thinking ? 'Yes' : 'No'})`}
              value={draft.enable_thinking}
              onValueChange={(value) =>
                onDraftChange({
                  ...draft,
                  enable_thinking: value as SamplingOverrideDraft['enable_thinking'],
                })
              }
              note={mandateNotesByField.get('enable_thinking')}
            />
          </div>

          {/* Read-only, unlike the eight fields above -- seed is not a
              SamplingOverrides field (app/schemas/runs.py), so there is
              nothing to type here. */}
          <p className="mt-3 text-xs text-muted-foreground">
            Seed: <span className="font-mono text-foreground">{baseProfile.seed}</span>
          </p>
        </>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* One block per field below (temperature through enable
              thinking) -- eight is fixed, not a guess at an unknown
              list length. */}
          {Array.from({ length: 8 }, (_, index) => index).map((index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      )}

      {hasChange && <LabelOverrideField value={labelValue} onValueChange={onLabelChange} />}
    </div>
  )
}
