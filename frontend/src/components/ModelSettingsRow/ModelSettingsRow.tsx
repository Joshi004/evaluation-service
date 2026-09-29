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

// One model's Settings-step row (Phase 10, docs/UI_REDESIGN_PLAN.md
// §8.10): a compact sampling/serving profile choice for the common
// case, plus a "Customize" panel reusing the same override cards
// Submit's own grid used to stack inline. The row's own two selects and
// the panel's own "Base profile" selects are the same underlying
// choice (`drafts.samplingProfileIdByCheckpointId`/
// `servingProfileIdByCheckpointId`) rendered twice -- changing either
// one is exactly the same edit.
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

  const isCustomized =
    samplingOverrideDraftHasChange(samplingDraftFor(drafts, checkpoint.id)) ||
    servingOverrideDraftHasChange(servingDraftFor(drafts, checkpoint.id))

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
            value={samplingProfileChoice ?? ''}
            onChange={(event) =>
              onDraftsChange(
                withSamplingProfileChoice(
                  drafts,
                  checkpoint.id,
                  event.target.value === '' ? null : Number(event.target.value),
                ),
              )
            }
            className="mt-1"
          >
            <option value="">{defaultProfileOptionLabel(checkpoint)}</option>
            {samplingOptions.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {samplingProfileOptionLabel(profile)}
              </option>
            ))}
          </SelectField>
          {baseSamplingProfile && (
            <p className="mt-1 text-xs text-muted-foreground">{samplingSummary(baseSamplingProfile)}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">Serving profile</span>
          <SelectField
            value={servingProfileChoice ?? ''}
            onChange={(event) =>
              onDraftsChange(
                withServingProfileChoice(
                  drafts,
                  checkpoint.id,
                  event.target.value === '' ? null : Number(event.target.value),
                ),
              )
            }
            className="mt-1"
          >
            <option value="">{defaultServingProfileOptionLabel(checkpoint)}</option>
            {servingOptions.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {servingProfileOptionLabel(profile)}
              </option>
            ))}
          </SelectField>
          {baseServingProfile && (
            <p className="mt-1 text-xs text-muted-foreground">
              {baseServingProfile.gpus} GPU{baseServingProfile.gpus === 1 ? '' : 's'} · {baseServingProfile.dtype}
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
