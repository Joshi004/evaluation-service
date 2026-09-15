// Non-DOM logic for CheckpointServingCard.tsx. Mirrors
// CheckpointSamplingCard.helper.ts's own namedSamplingProfiles /
// resolveBaseSamplingProfile / defaultProfileOptionLabel, one profile
// axis over -- there is no serving analogue of that file's third export
// (samplingMandateNotesByField): a standard's own `sampling_overrides`
// has no serving counterpart, so no selected standard ever mandates a
// serving field.
import type { CheckpointListItem, ServingProfileSummary } from '../../api/client'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'

// GET /serving-profiles returns ad-hoc rows too (label === null) --
// this card offers a submit-time choice of one *named* profile, not a
// customisation form, so an unlabelled row never belongs in its
// options. Mirrors CheckpointSamplingCard.helper.ts's own
// namedSamplingProfiles.
export function namedServingProfiles(profiles: ServingProfileSummary[]): ServingProfileSummary[] {
  return profiles.filter((profile) => profile.label !== null)
}

// This checkpoint's base serving profile: whichever one this card's
// picker explicitly chose, or the checkpoint's own registered default
// otherwise (mirrors resolveBaseSamplingProfile's same S-D9 fallback,
// one axis over). Null only while `/serving-profiles` is still loading
// -- default_serving_profile_id is a NOT NULL foreign key, so a fully
// loaded list always has an entry for it.
export function resolveBaseServingProfile(
  checkpoint: CheckpointListItem,
  profileChoice: number | null,
  servingProfilesById: Map<number, ServingProfileSummary>,
): ServingProfileSummary | null {
  const profileId = profileChoice ?? checkpoint.default_serving_profile_id
  return servingProfilesById.get(profileId) ?? null
}

export function defaultServingProfileOptionLabel(checkpoint: CheckpointListItem): string {
  const name = servingProfileDisplayName(checkpoint.serving_profile_label, checkpoint.serving_profile_hash)
  return `Its registered default (${name})`
}

// max_model_len's own resolved default can legitimately be null -- "no
// --max-model-len flag" (ServingProfilePicker.helper.ts's
// DEFAULT_SERVING_PROFILE_CONFIG). Mirrors StandardOverrideCard.helper.ts's
// sampleLimitPlaceholder, and reuses ServingProfilePicker.tsx's own
// "unset" wording for the same field so the two forms never describe a
// null max_model_len two different ways.
export function maxModelLenPlaceholder(maxModelLen: number | null): string {
  return maxModelLen === null ? 'unset' : String(maxModelLen)
}
