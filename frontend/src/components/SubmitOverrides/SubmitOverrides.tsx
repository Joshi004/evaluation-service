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

interface SubmitOverridesProps {
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

// Overrides split per-axis, not one grid-wide editor (Phase 8): a
// standard's shape belongs to that standard alone regardless of which
// checkpoint runs it, and a checkpoint's sampling and serving each
// belong to that checkpoint alone regardless of which standard it runs
// against (see app/schemas/runs.py's CreateRunsRequest) -- one card per
// selected item on each axis, instead of one shared OverrideEditor.tsx
// (removed by this change) whose fields silently applied to every
// selected checkpoint and standard at once.
export function SubmitOverrides({
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
  // Recomputed on every render rather than memoised -- these walk at
  // most a handful of selected checkpoints/standards each, and
  // memoising would need to compare `drafts` by more than reference
  // anyway (it's replaced wholesale on every keystroke).
  const standardLabels = resolveStandardLabels(selectedStandards, standardsById, drafts)
  const samplingLabels = resolveSamplingLabels(selectedCheckpoints, samplingProfilesById, drafts)
  const servingLabels = resolveServingLabels(selectedCheckpoints, servingProfilesById, drafts)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-300">Sampling, per checkpoint</h3>
        <p className="mt-1 text-xs text-slate-500">
          Each field&apos;s placeholder is that checkpoint&apos;s current default -- type a value to
          override it, or pick a different base profile to change every placeholder at once.
        </p>
        <div className="mt-2 space-y-3">
          {selectedCheckpoints.length === 0 ? (
            <p className="text-sm text-slate-500">Select at least one checkpoint to configure its sampling.</p>
          ) : (
            selectedCheckpoints.map((checkpoint) => (
              <CheckpointSamplingCard
                key={checkpoint.id}
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
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300">Serving, per checkpoint</h3>
        <p className="mt-1 text-xs text-slate-500">
          Each field&apos;s placeholder is that checkpoint&apos;s current default -- type a value to
          override it, or pick a different base profile to change every placeholder at once.
        </p>
        <div className="mt-2 space-y-3">
          {selectedCheckpoints.length === 0 ? (
            <p className="text-sm text-slate-500">Select at least one checkpoint to configure its serving.</p>
          ) : (
            selectedCheckpoints.map((checkpoint) => (
              <CheckpointServingCard
                key={checkpoint.id}
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
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300">Evaluation shape, per standard</h3>
        <p className="mt-1 text-xs text-slate-500">
          Each field&apos;s placeholder is that standard&apos;s published default.
        </p>
        <div className="mt-2 space-y-3">
          {selectedStandards.length === 0 ? (
            <p className="text-sm text-slate-500">Select at least one standard to configure its shape.</p>
          ) : (
            selectedStandards.map((standard) => (
              <StandardOverrideCard
                key={standard.id}
                standard={standard}
                draft={standardDraftFor(drafts, standard.id)}
                onDraftChange={(draft) => onDraftsChange(withStandardDraft(drafts, standard.id, draft))}
                labelValue={standardLabels[standard.id] ?? ''}
                onLabelChange={(label) => onDraftsChange(withStandardLabel(drafts, standard.id, label))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
