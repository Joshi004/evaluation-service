import type { UseQueryResult } from '@tanstack/react-query'
import type {
  CheckpointListItem,
  LeaderboardRow,
  RunPreview,
  SamplingProfileSummary,
  ServingProfileSummary,
  StandardSummary,
} from '../../api/client'
import { BenchmarkSettingsRow } from '../BenchmarkSettingsRow/BenchmarkSettingsRow'
import { ModelSettingsRow } from '../ModelSettingsRow/ModelSettingsRow'
import { SetupAlignmentList } from '../SetupAlignmentList/SetupAlignmentList'
import type { SubmitOverrideDrafts } from '../SubmitOverrides/SubmitOverrides.helper'

interface NewEvaluationSettingsStepProps {
  selectedCheckpoints: CheckpointListItem[]
  selectedStandards: StandardSummary[]
  standardsById: Map<number, StandardSummary>
  samplingProfiles: SamplingProfileSummary[]
  samplingProfilesById: Map<number, SamplingProfileSummary>
  servingProfiles: ServingProfileSummary[]
  servingProfilesById: Map<number, ServingProfileSummary>
  drafts: SubmitOverrideDrafts
  onDraftsChange: (drafts: SubmitOverrideDrafts) => void
  preview: RunPreview | undefined
  isPreviewFetching: boolean
  leaderboardQuery: UseQueryResult<LeaderboardRow[]>
}

// Step 2 of New evaluation: a row per selected model, a row per
// selected benchmark, then one shared answer to "will this line up
// with the leaderboard?" below both -- the recommended defaults need
// no reading; a row's own "Customize" panel is where a submitter goes
// to change something.
export function NewEvaluationSettingsStep({
  selectedCheckpoints,
  selectedStandards,
  standardsById,
  samplingProfiles,
  samplingProfilesById,
  servingProfiles,
  servingProfilesById,
  drafts,
  onDraftsChange,
  preview,
  isPreviewFetching,
  leaderboardQuery,
}: NewEvaluationSettingsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-foreground">Models</h2>
        <div className="mt-2 space-y-2">
          {selectedCheckpoints.map((checkpoint) => (
            <ModelSettingsRow
              key={checkpoint.id}
              checkpoint={checkpoint}
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
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-foreground">Benchmarks</h2>
        <div className="mt-2 space-y-2">
          {selectedStandards.map((standard) => (
            <BenchmarkSettingsRow
              key={standard.id}
              standard={standard}
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
          ))}
        </div>
      </div>

      <SetupAlignmentList
        preview={preview}
        isPreviewFetching={isPreviewFetching}
        samplingProfiles={samplingProfiles}
        leaderboardQuery={leaderboardQuery}
      />
    </div>
  )
}
