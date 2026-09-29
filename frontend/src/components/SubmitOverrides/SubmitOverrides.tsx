import type {
  CheckpointListItem,
  SamplingProfileSummary,
  ServingProfileSummary,
  StandardSummary,
} from '../../api/client'
import { CheckpointSamplingCard } from '../CheckpointSamplingCard/CheckpointSamplingCard'
import { CheckpointServingCard } from '../CheckpointServingCard/CheckpointServingCard'
import { StandardOverrideCard } from '../StandardOverrideCard/StandardOverrideCard'
import {
  resolveSamplingLabels,
  resolveServingLabels,
  resolveStandardLabels,
  samplingDraftFor,
  servingDraftFor,
  standardDraftFor,
  withSamplingDraft,
  withSamplingLabel,
  withSamplingProfileChoice,
  withServingDraft,
  withServingLabel,
  withServingProfileChoice,
  withStandardDraft,
  withStandardLabel,
  type SubmitOverrideDrafts,
} from './SubmitOverrides.helper'

// Which one item's cards to render -- a model gets its sampling and
// serving cards, a benchmark gets its protocol card. New evaluation's
// Settings step (docs/UI_REDESIGN_PLAN.md §8.10) opens one of these at
// a time, in a `SidePanel` per row, rather than stacking every selected
// item's cards on one page the way the original Submit page did.
export type SubmitOverridesScope =
  | { kind: 'checkpoint'; checkpointId: number }
  | { kind: 'standard'; standardId: number }

interface SubmitOverridesProps {
  scope: SubmitOverridesScope
  selectedCheckpoints: CheckpointListItem[]
  selectedStandards: StandardSummary[]
  // Full catalog, not just selectedStandards -- resolveStandardLabels
  // needs every existing label to avoid suggesting one already taken,
  // not just the ones on standards currently selected in the grid.
  standardsById: Map<number, StandardSummary>
  samplingProfiles: SamplingProfileSummary[]
  samplingProfilesById: Map<number, SamplingProfileSummary>
  servingProfiles: ServingProfileSummary[]
  servingProfilesById: Map<number, ServingProfileSummary>
  drafts: SubmitOverrideDrafts
  onDraftsChange: (drafts: SubmitOverrideDrafts) => void
}

// Overrides split per-axis, not one grid-wide editor: a standard's
// shape belongs to that standard alone regardless of which checkpoint
// runs it, and a checkpoint's sampling and serving each belong to that
// checkpoint alone regardless of which standard it runs against (see
// app/schemas/runs.py's CreateRunsRequest). Label suggestions still
// resolve over the *whole* current selection (every card below reads
// `selectedCheckpoints`/`selectedStandards` in full, not just the one
// item in `scope`) -- two checkpoints both defaulting to a 'greedy'
// sampling profile must still suggest 'greedy-01' and 'greedy-02', not
// the same name twice, even though only one of their cards is open at
// once.
export function SubmitOverrides({
  scope,
  selectedCheckpoints,
  selectedStandards,
  standardsById,
  samplingProfiles,
  samplingProfilesById,
  servingProfiles,
  servingProfilesById,
  drafts,
  onDraftsChange,
}: SubmitOverridesProps) {
  const standardLabels = resolveStandardLabels(selectedStandards, standardsById, drafts)
  const samplingLabels = resolveSamplingLabels(selectedCheckpoints, samplingProfilesById, drafts)
  const servingLabels = resolveServingLabels(selectedCheckpoints, servingProfilesById, drafts)

  if (scope.kind === 'standard') {
    const standard = selectedStandards.find((candidate) => candidate.id === scope.standardId)
    if (!standard) {
      return null
    }
    return (
      <StandardOverrideCard
        standard={standard}
        draft={standardDraftFor(drafts, standard.id)}
        onDraftChange={(draft) => onDraftsChange(withStandardDraft(drafts, standard.id, draft))}
        labelValue={standardLabels[standard.id] ?? ''}
        onLabelChange={(label) => onDraftsChange(withStandardLabel(drafts, standard.id, label))}
      />
    )
  }

  const checkpoint = selectedCheckpoints.find((candidate) => candidate.id === scope.checkpointId)
  if (!checkpoint) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Sampling</h3>
        <div className="mt-2">
          <CheckpointSamplingCard
            checkpoint={checkpoint}
            samplingProfiles={samplingProfiles}
            samplingProfilesById={samplingProfilesById}
            selectedStandards={selectedStandards}
            profileChoice={drafts.samplingProfileIdByCheckpointId[checkpoint.id] ?? null}
            onProfileChoiceChange={(choice) =>
              onDraftsChange(withSamplingProfileChoice(drafts, checkpoint.id, choice))
            }
            draft={samplingDraftFor(drafts, checkpoint.id)}
            onDraftChange={(draft) => onDraftsChange(withSamplingDraft(drafts, checkpoint.id, draft))}
            labelValue={samplingLabels[checkpoint.id] ?? ''}
            onLabelChange={(label) => onDraftsChange(withSamplingLabel(drafts, checkpoint.id, label))}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground">Serving</h3>
        <div className="mt-2">
          <CheckpointServingCard
            checkpoint={checkpoint}
            servingProfiles={servingProfiles}
            servingProfilesById={servingProfilesById}
            profileChoice={drafts.servingProfileIdByCheckpointId[checkpoint.id] ?? null}
            onProfileChoiceChange={(choice) =>
              onDraftsChange(withServingProfileChoice(drafts, checkpoint.id, choice))
            }
            draft={servingDraftFor(drafts, checkpoint.id)}
            onDraftChange={(draft) => onDraftsChange(withServingDraft(drafts, checkpoint.id, draft))}
            labelValue={servingLabels[checkpoint.id] ?? ''}
            onLabelChange={(label) => onDraftsChange(withServingLabel(drafts, checkpoint.id, label))}
          />
        </div>
      </div>
    </div>
  )
}
