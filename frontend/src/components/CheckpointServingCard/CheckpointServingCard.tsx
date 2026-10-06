import type { CheckpointListItem, ServingProfileSummary } from '../../api/client'
import { isToolCallingComplete, parserOptionsFor, readToolCalling } from '../../utils/toolCalling'
import {
  LabelOverrideField,
  NumberOverrideField,
  SelectOverrideField,
  TextOverrideField,
} from '../OverrideField/OverrideField'
import { SelectField } from '../SelectField/SelectField'
import { Skeleton } from '../Skeleton/Skeleton'
import {
  effectiveServingConfig,
  servingOverrideDraftHasChange,
  type ServingOverrideDraft,
} from '../SubmitOverrides/SubmitOverrides.helper'
import {
  defaultServingProfileOptionLabel,
  maxModelLenPlaceholder,
  resolveBaseServingProfile,
  servingProfileOptionLabel,
  servingProfileOptions,
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

// One selected checkpoint's serving: which base profile it starts from
// (its own registered default, or one picked here) plus the ten
// ServingOverrides fields, each defaulting to that base profile's own
// value. Mirrors CheckpointSamplingCard.tsx exactly, one axis over --
// serving gained a submit-time override so a different
// gpus/tensor_parallel_size can be tried for one run without
// re-registering the checkpoint (docs/TaskList.md item 4 has no PATCH
// endpoint for editing a registered checkpoint's own default).
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
  const options = servingProfileOptions(profileChoice, servingProfiles, servingProfilesById)
  const hasChange = servingOverrideDraftHasChange(draft)

  return (
    <div>
      <label className="block">
        <span className="text-xs text-muted-foreground">Base serving profile</span>
        <SelectField
          value={profileChoice === null ? '' : String(profileChoice)}
          onValueChange={(value) => onProfileChoiceChange(value === '' ? null : Number(value))}
          groups={[
            {
              options: [
                { value: '', label: defaultServingProfileOptionLabel(checkpoint) },
                ...options.map((profile) => ({ value: String(profile.id), label: servingProfileOptionLabel(profile) })),
              ],
            },
          ]}
          className="mt-1 w-full"
        />
      </label>

      {baseProfile ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
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
          <ToolCallingOverrideFields baseProfile={baseProfile} draft={draft} onDraftChange={onDraftChange} />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* One block per field above (GPUs through Tool call parser)
              -- ten is fixed, not a guess at an unknown list length. */}
          {Array.from({ length: 10 }, (_, index) => index).map((index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      )}

      {hasChange && <LabelOverrideField value={labelValue} onValueChange={onLabelChange} />}
    </div>
  )
}

const AUTO_TOOL_CHOICE_OPTIONS = [
  { value: 'true', label: 'On' },
  { value: 'false', label: 'Off' },
]

interface ToolCallingOverrideFieldsProps {
  baseProfile: ServingProfileSummary
  draft: ServingOverrideDraft
  onDraftChange: (draft: ServingOverrideDraft) => void
}

// The two tool-calling fields, as cells of the card's own grid. Both
// show the base profile's value as their "Default" option, like every
// other field here. The parser stays disabled while tool calling would
// be off -- either the base has it off and nothing turns it on, or this
// draft switches it off -- since vLLM only uses a parser together with
// auto tool choice.
function ToolCallingOverrideFields({ baseProfile, draft, onDraftChange }: ToolCallingOverrideFieldsProps) {
  const baseToolCalling = readToolCalling(baseProfile.engine_options)
  const effectiveToolCalling = readToolCalling(effectiveServingConfig(baseProfile, draft).engine_options)
  const needsParser = !isToolCallingComplete(effectiveToolCalling)

  return (
    <>
      <SelectOverrideField
        label="Auto tool choice"
        options={AUTO_TOOL_CHOICE_OPTIONS}
        defaultOptionLabel={`Default (${baseToolCalling.autoToolChoice ? 'On' : 'Off'})`}
        value={draft.enable_auto_tool_choice}
        onValueChange={(value) =>
          onDraftChange({
            ...draft,
            enable_auto_tool_choice: value as ServingOverrideDraft['enable_auto_tool_choice'],
          })
        }
      />
      <SelectOverrideField
        label="Tool call parser"
        options={parserOptionsFor(baseToolCalling.parser).map((name) => ({ value: name, label: name }))}
        defaultOptionLabel={`Default (${baseToolCalling.parser ?? 'none'})`}
        value={draft.tool_call_parser}
        disabled={!effectiveToolCalling.autoToolChoice}
        onValueChange={(value) => onDraftChange({ ...draft, tool_call_parser: value })}
        note={needsParser ? 'Choose a parser to use auto tool choice.' : undefined}
      />
    </>
  )
}
