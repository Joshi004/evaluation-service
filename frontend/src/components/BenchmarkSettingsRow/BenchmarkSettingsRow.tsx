import { useState } from 'react'
import type {
  CheckpointListItem,
  SamplingProfileSummary,
  ServingProfileSummary,
  StandardSummary,
} from '../../api/client'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import { SidePanel } from '../SidePanel/SidePanel'
import {
  effectiveStandardProtocol,
  standardDraftFor,
  standardOverrideDraftHasChange,
  type SubmitOverrideDrafts,
} from '../SubmitOverrides/SubmitOverrides.helper'
import { SubmitOverrides } from '../SubmitOverrides/SubmitOverrides'
import { benchmarkVersion } from '../../utils/benchmarkDisplayName'
import { protocolSummary } from '../../utils/protocolSummary'

interface BenchmarkSettingsRowProps {
  standard: StandardSummary
  // The whole current selection -- see ModelSettingsRow's own comment
  // on why SubmitOverrides needs all of it, not just this row's
  // standard.
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

// One benchmark's Settings-step row: name, version and its *effective*
// protocol at a glance -- the catalog's own published shape, or
// whatever this row's own "Customize protocol" panel has typed in
// place of it (effectiveStandardProtocol merges the two the same way a
// real submit would) -- plus that panel itself, reusing
// StandardOverrideCard. Unlike ModelSettingsRow, there is no inline
// select here -- a benchmark's shape has no "which named alternative"
// choice the way a sampling or serving profile does, only individual
// fields to override.
export function BenchmarkSettingsRow({
  standard,
  selectedCheckpoints,
  selectedStandards,
  standardsById,
  samplingProfiles,
  samplingProfilesById,
  servingProfiles,
  servingProfilesById,
  drafts,
  onDraftsChange,
}: BenchmarkSettingsRowProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const version = benchmarkVersion(standard.label)
  const draft = standardDraftFor(drafts, standard.id)
  const isCustomized = standardOverrideDraftHasChange(draft)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{standard.display_name ?? standard.benchmark}</span>
          {version && <Badge tone="neutral">{version}</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{protocolSummary(effectiveStandardProtocol(standard, draft))}</p>
      </div>

      <div className="flex items-center gap-2">
        {isCustomized && <Badge tone="info">Customized</Badge>}
        <Button variant="secondary" size="sm" onClick={() => setIsPanelOpen(true)}>
          Customize protocol
        </Button>
      </div>

      <SidePanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        title="Customize protocol"
        description={standard.display_name ?? standard.benchmark}
        footer={
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setIsPanelOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <SubmitOverrides
          scope={{ kind: 'standard', standardId: standard.id }}
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
