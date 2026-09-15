import type { CheckpointListItem, ServingProfileSummary } from '../../api/client'
import { LabelOverrideField, NumberOverrideField, TextOverrideField } from '../OverrideField/OverrideField'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'
import {
  servingOverrideDraftHasChange,
  type ServingOverrideDraft,
} from '../SubmitOverrides/SubmitOverrides.helper'
import {
  defaultServingProfileOptionLabel,
  maxModelLenPlaceholder,
  namedServingProfiles,
  resolveBaseServingProfile,
} from './CheckpointServingCard.helper'

interface CheckpointServingCardProps {
  checkpoint: CheckpointListItem
  servingProfiles: ServingProfileSummary[]
  servingProfilesById: Map<number, ServingProfileSummary>
  // null = "use this checkpoint's own registered default" -- mirrors
  // CheckpointSamplingCard's own profileChoice, one axis over.
  profileChoice: number | null
  onProfileChoiceChange: (choice: number | null) => void
  draft: ServingOverrideDraft
  onDraftChange: (draft: ServingOverrideDraft) => void
  // Already resolved by SubmitOverrides.tsx -- whatever this card's own
  // label draft holds, or else a computed suggestion. See
  // SubmitOverrides.helper.ts's resolveServingLabels.
  labelValue: string
  onLabelChange: (label: string) => void
}

const SELECT_CLASS_NAME =
  'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200'

// One selected checkpoint's serving: which base profile it starts from
// (its own registered default, or one picked here) plus the eight
// ServingOverrides fields, each defaulting to that base profile's own
// value. Mirrors CheckpointSamplingCard.tsx exactly, one axis over --
// see this repo's labels_and_serving_overrides plan for why serving
// gained a submit-time override at all: it used to be entirely fixed at
// registration (docs/TaskList.md item 4 has no PATCH endpoint), with no
// way to try a different gpus/tensor_parallel_size for one run without
// re-registering the checkpoint.
export function CheckpointServingCard({
  checkpoint,
  servingProfiles,
  servingProfilesById,
  profileChoice,
  onProfileChoiceChange,
  draft,
  onDraftChange,
  labelValue,
  onLabelChange,
}: CheckpointServingCardProps) {
  const baseProfile = resolveBaseServingProfile(checkpoint, profileChoice, servingProfilesById)
  const named = namedServingProfiles(servingProfiles)
  const hasChange = servingOverrideDraftHasChange(draft)

  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-200">{checkpoint.name}</span>
      </div>

      <label className="mt-3 block">
        <span className="text-xs text-slate-500">Base serving profile</span>
        <select
          value={profileChoice ?? ''}
          onChange={(event) =>
            onProfileChoiceChange(event.target.value === '' ? null : Number(event.target.value))
          }
          className={SELECT_CLASS_NAME}
        >
          <option value="">{defaultServingProfileOptionLabel(checkpoint)}</option>
          {named.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {servingProfileDisplayName(profile.label, profile.hash)}
            </option>
          ))}
        </select>
      </label>

      {baseProfile ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberOverrideField
            label="GPUs"
            step="1"
            defaultValue={String(baseProfile.gpus)}
            value={draft.gpus}
            onValueChange={(value) => onDraftChange({ ...draft, gpus: value })}
          />
          <NumberOverrideField
            label="Tensor parallel size"
            step="1"
            defaultValue={String(baseProfile.tensor_parallel_size)}
            value={draft.tensor_parallel_size}
            onValueChange={(value) => onDraftChange({ ...draft, tensor_parallel_size: value })}
          />
          <NumberOverrideField
            label="Pipeline parallel size"
            step="1"
            defaultValue={String(baseProfile.pipeline_parallel_size)}
            value={draft.pipeline_parallel_size}
            onValueChange={(value) => onDraftChange({ ...draft, pipeline_parallel_size: value })}
          />
          <NumberOverrideField
            label="Max model length"
            step="1"
            defaultValue={maxModelLenPlaceholder(baseProfile.max_model_len)}
            value={draft.max_model_len}
            onValueChange={(value) => onDraftChange({ ...draft, max_model_len: value })}
          />
          <TextOverrideField
            label="Reasoning parser"
            defaultValue={baseProfile.reasoning_parser ?? 'none'}
            value={draft.reasoning_parser}
            onValueChange={(value) => onDraftChange({ ...draft, reasoning_parser: value })}
          />
          <TextOverrideField
            label="Dtype"
            defaultValue={baseProfile.dtype}
            value={draft.dtype}
            onValueChange={(value) => onDraftChange({ ...draft, dtype: value })}
          />
          <TextOverrideField
            label="Quantization"
            defaultValue={baseProfile.quantization ?? 'none'}
            value={draft.quantization}
            onValueChange={(value) => onDraftChange({ ...draft, quantization: value })}
          />
          <NumberOverrideField
            label="GPU memory utilization"
            step="0.01"
            defaultValue={String(baseProfile.gpu_memory_utilization)}
            value={draft.gpu_memory_utilization}
            onValueChange={(value) => onDraftChange({ ...draft, gpu_memory_utilization: value })}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Loading serving profile…</p>
      )}

      {hasChange && <LabelOverrideField value={labelValue} onValueChange={onLabelChange} />}
    </div>
  )
}
