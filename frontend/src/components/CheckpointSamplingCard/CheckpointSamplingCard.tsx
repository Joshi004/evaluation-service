import type { CheckpointListItem, SamplingProfileSummary, StandardSummary } from '../../api/client'
import { LabelOverrideField, NumberOverrideField, SelectOverrideField } from '../OverrideField/OverrideField'
import { samplingProfileDisplayName } from '../../utils/samplingProfileDisplayName'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'
import {
  samplingOverrideDraftHasChange,
  type SamplingOverrideDraft,
} from '../SubmitOverrides/SubmitOverrides.helper'
import {
  defaultProfileOptionLabel,
  namedSamplingProfiles,
  resolveBaseSamplingProfile,
  samplingMandateNotesByField,
} from './CheckpointSamplingCard.helper'

interface CheckpointSamplingCardProps {
  checkpoint: CheckpointListItem
  samplingProfiles: SamplingProfileSummary[]
  samplingProfilesById: Map<number, SamplingProfileSummary>
  selectedStandards: StandardSummary[]
  // null = "use this checkpoint's own registered default" (S-D9's
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

const SELECT_CLASS_NAME =
  'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200'

const ENABLE_THINKING_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

// One selected checkpoint's sampling: which base profile it starts
// from (its own registered default, or one picked here) plus the eight
// SamplingOverrides fields, each defaulting to that base profile's own
// value. Picking a different base profile updates every field's
// placeholder at once -- the merge of the old grid-wide picker's
// read-only value table (SamplingProfilePicker.tsx, removed by this
// change) into fields that are also where you'd type an override.
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
  const named = namedSamplingProfiles(samplingProfiles)
  const hasChange = samplingOverrideDraftHasChange(draft)

  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-200">{checkpoint.name}</span>
        {/* Read-only here -- caps max_tokens and drives the preview's
            GPU count, but overriding it is CheckpointServingCard's own
            job (the "Serving, per checkpoint" section), not this
            card's. */}
        <span className="text-xs text-slate-500">
          serving:{' '}
          {servingProfileDisplayName(checkpoint.serving_profile_label, checkpoint.serving_profile_hash)}
        </span>
      </div>

      <label className="mt-3 block">
        <span className="text-xs text-slate-500">Base sampling profile</span>
        <select
          value={profileChoice ?? ''}
          onChange={(event) =>
            onProfileChoiceChange(event.target.value === '' ? null : Number(event.target.value))
          }
          className={SELECT_CLASS_NAME}
        >
          <option value="">{defaultProfileOptionLabel(checkpoint)}</option>
          {named.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {samplingProfileDisplayName(profile.label, profile.hash)}
            </option>
          ))}
        </select>
      </label>

      {baseProfile ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          <p className="mt-3 text-xs text-slate-500">
            Seed: <span className="font-mono text-slate-400">{baseProfile.seed}</span>
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Loading sampling profile…</p>
      )}

      {hasChange && <LabelOverrideField value={labelValue} onValueChange={onLabelChange} />}
    </div>
  )
}
