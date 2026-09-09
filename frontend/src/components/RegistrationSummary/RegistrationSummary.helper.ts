// Non-DOM logic for RegistrationSummary.tsx: describing the
// serving-profile branch of a RegisterCheckpointRequest in words.
import type { ServingProfileSelection, ServingProfileSummary } from '../../api/client'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'

// Distinguishes reusing a persisted profile from minting a possibly-new
// one. Only the server can say for certain whether a customisation
// matches an existing hash (resolve-or-insert, R-D22), so this states
// the possibility rather than a false certainty.
export function describeServingProfileSelection(
  selection: ServingProfileSelection,
  profiles: ServingProfileSummary[],
): string {
  if ('existing_profile_id' in selection) {
    const profile = profiles.find((candidate) => candidate.id === selection.existing_profile_id)
    return profile
      ? `Reuses profile ${servingProfileDisplayName(profile.label, profile.hash)}`
      : `Reuses profile #${selection.existing_profile_id}`
  }
  return 'Customised — reuses an identical profile if one exists, otherwise creates a new one'
}
