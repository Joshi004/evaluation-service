import { useState } from 'react'
import type {
  CheckpointListItem,
  SamplingProfileSummary,
  ServingProfileSummary,
  StandardSummary,
} from '../../api/client'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import {
  defaultProfileOptionLabel,
  resolveBaseSamplingProfile,
  samplingProfileOptionLabel,
  samplingProfileOptions,
} from '../CheckpointSamplingCard/CheckpointSamplingCard.helper'
import {
  defaultServingProfileOptionLabel,
  resolveBaseServingProfile,
  servingProfileOptionLabel,
  servingProfileOptions,
} from '../CheckpointServingCard/CheckpointServingCard.helper'
import { ModelName } from '../ModelName/ModelName'
import { SelectField } from '../SelectField/SelectField'
import { SidePanel } from '../SidePanel/SidePanel'
import {
  effectiveSamplingConfig,
  effectiveServingConfig,
  samplingDraftFor,
  samplingOverrideDraftHasChange,
  servingDraftFor,
  servingOverrideDraftHasChange,
  withSamplingProfileChoice,
  withServingProfileChoice,
  type SubmitOverrideDrafts,
} from '../SubmitOverrides/SubmitOverrides.helper'
import { SubmitOverrides } from '../SubmitOverrides/SubmitOverrides'
import { samplingSummary } from '../../utils/samplingSummary'

interface ModelSettingsRowProps {
  checkpoint: CheckpointListItem
  // The whole current selection, not just this row's own checkpoint --
  // SubmitOverrides' own label suggestions need every selected
  // checkpoint and standard to stay collision-free (its own docstring).
  selectedCheckpoints: CheckpointListItem[]
  selectedStandards: StandardSummary[]
  standardsById: Map<number, StandardSummary>
  samplingProfiles: SamplingProfileSummary[]
  samplingProfilesById: Map<number, SamplingProfileSummary>
  servingProfiles: ServingProfileSummary[]
  servingProfilesById: Map<number, ServingProfileSummary>
  drafts: SubmitOverrideDrafts
  onDraftsChange: (drafts: SubmitOverrideDrafts) => void
}

// One model's Settings-step row: a compact sampling/serving profile
// choice for the common case, plus a "Customize" panel reusing the
// same override cards. The row's own two selects and the panel's own
// "Base profile" selects are the same underlying
// choice (`drafts.samplingProfileIdByCheckpointId`/
// `servingProfileIdByCheckpointId`) rendered twice -- changing either
// one is exactly the same edit. The one-line summary under each select
// is the *effective* config -- the base profile merged with whatever
// this row's own Customize panel has typed (effectiveSamplingConfig/
// effectiveServingConfig), not the base profile alone, so it never
// shows a value a real submit wouldn't also send.
export function ModelSettingsRow({
  checkpoint,
  selectedCheckpoints,
  selectedStandards,
  standardsById,
  samplingProfiles,
  samplingProfilesById,
  servingProfiles,
  servingProfilesById,
  drafts,
  onDraftsChange,
}: ModelSettingsRowProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const samplingProfileChoice = drafts.samplingProfileIdByCheckpointId[checkpoint.id] ?? null
  const servingProfileChoice = drafts.servingProfileIdByCheckpointId[checkpoint.id] ?? null
  const baseSamplingProfile = resolveBaseSamplingProfile(checkpoint, samplingProfileChoice, samplingProfilesById)
  const baseServingProfile = resolveBaseServingProfile(checkpoint, servingProfileChoice, servingProfilesById)
  const samplingOptions = samplingProfileOptions(samplingProfileChoice, samplingProfiles, samplingProfilesById)
  const servingOptions = servingProfileOptions(servingProfileChoice, servingProfiles, servingProfilesById)

  const samplingDraft = samplingDraftFor(drafts, checkpoint.id)
  const servingDraft = servingDraftFor(drafts, checkpoint.id)
  const isCustomized =
    samplingOverrideDraftHasChange(samplingDraft) || servingOverrideDraftHasChange(servingDraft)

  // null only while the base profile is still loading (same fallback
  // baseSamplingProfile/baseServingProfile already give) -- merges this
  // row's own Customize draft onto that base so the summary line below
  // never shows a value a real submit wouldn't also send.
  const effectiveSampling = baseSamplingProfile ? effectiveSamplingConfig(baseSamplingProfile, samplingDraft) : null
  const effectiveServing = baseServingProfile ? effectiveServingConfig(baseServingProfile, servingDraft) : null

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ModelName name={checkpoint.name} family={checkpoint.family} />
        <div className="flex items-center gap-2">
          {isCustomized && <Badge tone="info">Customized</Badge>}
          <Button variant="secondary" size="sm" onClick={() => setIsPanelOpen(true)}>
            Customize
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-muted-foreground">Sampling profile</span>
          <SelectField
            value={samplingProfileChoice === null ? '' : String(samplingProfileChoice)}
            onValueChange={(value) =>
              onDraftsChange(withSamplingProfileChoice(drafts, checkpoint.id, value === '' ? null : Number(value)))
            }
            groups={[
              {
                options: [
                  { value: '', label: defaultProfileOptionLabel(checkpoint) },
                  ...samplingOptions.map((profile) => ({
                    value: String(profile.id),
                    label: samplingProfileOptionLabel(profile),
                  })),
                ],
              },
            ]}
            className="mt-1 w-full"
          />
          {effectiveSampling && (
            <p className="mt-1 text-xs text-muted-foreground">{samplingSummary(effectiveSampling)}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">Serving profile</span>
          <SelectField
            value={servingProfileChoice === null ? '' : String(servingProfileChoice)}
            onValueChange={(value) =>
              onDraftsChange(withServingProfileChoice(drafts, checkpoint.id, value === '' ? null : Number(value)))
            }
            groups={[
              {
                options: [
                  { value: '', label: defaultServingProfileOptionLabel(checkpoint) },
                  ...servingOptions.map((profile) => ({
                    value: String(profile.id),
                    label: servingProfileOptionLabel(profile),
                  })),
                ],
              },
            ]}
            className="mt-1 w-full"
          />
          {effectiveServing && (
            <p className="mt-1 text-xs text-muted-foreground">
              {effectiveServing.gpus} GPU{effectiveServing.gpus === 1 ? '' : 's'} · {effectiveServing.dtype}
            </p>
          )}
        </label>
      </div>

      <SidePanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        title="Customize"
        description={<ModelName name={checkpoint.name} family={checkpoint.family} />}
        footer={
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setIsPanelOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <SubmitOverrides
          scope={{ kind: 'checkpoint', checkpointId: checkpoint.id }}
          selectedCheckpoints={selectedCheckpoints}
          selectedStandards={selectedStandards}
          standardsById={standardsById}
          samplingProfiles={samplingProfiles}
          samplingProfilesById={samplingProfilesById}
          servingProfiles={servingProfiles}
          servingProfilesById={servingProfilesById}
          drafts={drafts}
          onDraftsChange={onDraftsChange}
        />
      </SidePanel>
    </div>
  )
}
