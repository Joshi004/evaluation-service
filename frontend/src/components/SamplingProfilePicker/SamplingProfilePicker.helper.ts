// Non-DOM logic for SamplingProfilePicker.tsx: the picker's choice type
// and how to resolve it against the fetched profile list and the
// grid's selected checkpoints.
import type { CheckpointListItem, SamplingProfileSummary } from '../../api/client'
import { samplingProfileDisplayName } from '../../utils/samplingProfileDisplayName'

// null = "use each checkpoint's default" (S-D35's first case). S-D9's
// fallback chain lives entirely in the backend -- omitting
// sampling_profile_id from the request body is what invokes it. A
// number is S-D35's second case: everything under this one profile.
export type SamplingProfileChoice = number | null

// GET /sampling-profiles returns ad-hoc rows too (label === null) --
// S-D35 offers a submit-time choice of one *named* profile, not a
// customisation form, so an unlabelled row never belongs in the
// picker's options.
export function namedSamplingProfiles(profiles: SamplingProfileSummary[]): SamplingProfileSummary[] {
  return profiles.filter((profile) => profile.label !== null)
}

export function findSamplingProfile(
  profiles: SamplingProfileSummary[],
  choice: SamplingProfileChoice,
): SamplingProfileSummary | null {
  if (choice === null) {
    return null
  }
  return profiles.find((profile) => profile.id === choice) ?? null
}

// What "use each checkpoint's default" actually means for the current
// grid -- S-D35's own reasoning for why the label must say so: three
// checkpoints under "default" can resolve to three different profiles,
// and the dry run is what shows that, but this sentence is what says
// so before a dry run even has pairs to show.
export function describeCheckpointDefaults(selectedCheckpoints: CheckpointListItem[]): string {
  if (selectedCheckpoints.length === 0) {
    return 'Select at least one checkpoint to see its default.'
  }

  const labels = [
    ...new Set(
      selectedCheckpoints.map((checkpoint) =>
        samplingProfileDisplayName(
          checkpoint.default_sampling_profile_label,
          checkpoint.default_sampling_profile_hash,
        ),
      ),
    ),
  ].sort()

  return labels.length === 1
    ? `Every selected checkpoint defaults to ${labels[0]}.`
    : `Selected checkpoints default to ${labels.length} different profiles: ${labels.join(', ')}.`
}
