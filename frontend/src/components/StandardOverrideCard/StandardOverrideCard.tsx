import type { StandardSummary } from '../../api/client'
import { THINK_HANDLING_LABELS } from '../../utils/labels'
import { formatSamplingOverrides } from '../DryRunPreview/DryRunPreview.helper'
import { LabelOverrideField, NumberOverrideField, SelectOverrideField } from '../OverrideField/OverrideField'
import {
  standardOverrideDraftHasChange,
  type StandardOverrideDraft,
} from '../SubmitOverrides/SubmitOverrides.helper'
import { sampleLimitPlaceholder } from './StandardOverrideCard.helper'

interface StandardOverrideCardProps {
  standard: StandardSummary
  draft: StandardOverrideDraft
  onDraftChange: (draft: StandardOverrideDraft) => void
  // Already resolved by SubmitOverrides.tsx -- whatever this card's own
  // label draft holds, or else a computed suggestion. See
  // SubmitOverrides.helper.ts's resolveStandardLabels.
  labelValue: string
  onLabelChange: (label: string) => void
}

const THINK_HANDLING_OPTIONS = [
  { value: 'strip', label: THINK_HANDLING_LABELS.strip },
  { value: 'as_is', label: THINK_HANDLING_LABELS.as_is },
]

// One selected standard's evaluation shape -- sample_limit, few_shot,
// repeats, think_handling -- with that standard's own published values
// as each field's default. Fields here never involve a checkpoint: a
// standard's shape resolves the same way regardless of which
// checkpoint runs it. Rendered inside its Settings row's own "Customize
// protocol" side panel -- the standard's own name is the panel's title,
// not repeated here.
export function StandardOverrideCard({ standard, draft, onDraftChange, labelValue, onLabelChange }: StandardOverrideCardProps) {
  const hasChange = standardOverrideDraftHasChange(draft)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <NumberOverrideField
          label="Sample limit"
          step="1"
          defaultValue={sampleLimitPlaceholder(standard.sample_limit)}
          value={draft.sample_limit}
          onValueChange={(value) => onDraftChange({ ...draft, sample_limit: value })}
        />
        <NumberOverrideField
          label="Few-shot"
          step="1"
          defaultValue={String(standard.few_shot)}
          value={draft.few_shot}
          onValueChange={(value) => onDraftChange({ ...draft, few_shot: value })}
        />
        <NumberOverrideField
          label="Repeats"
          step="1"
          defaultValue={String(standard.repeats)}
          value={draft.repeats}
          onValueChange={(value) => onDraftChange({ ...draft, repeats: value })}
        />
        <SelectOverrideField
          label="Think handling"
          options={THINK_HANDLING_OPTIONS}
          defaultOptionLabel={`Default (${THINK_HANDLING_LABELS[standard.think_handling]})`}
          value={draft.think_handling}
          onValueChange={(value) =>
            onDraftChange({
              ...draft,
              think_handling: value as StandardOverrideDraft['think_handling'],
            })
          }
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Sampling mandate: {formatSamplingOverrides(standard.sampling_overrides)}
      </p>

      {hasChange && <LabelOverrideField value={labelValue} onValueChange={onLabelChange} />}
    </div>
  )
}
