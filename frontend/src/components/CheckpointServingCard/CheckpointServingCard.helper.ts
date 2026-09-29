// Non-DOM logic for CheckpointServingCard.tsx. Mirrors
// CheckpointSamplingCard.helper.ts's own samplingProfileOptions /
// resolveBaseSamplingProfile / defaultProfileOptionLabel, one profile
// axis over -- there is no serving analogue of that file's third export
// (samplingMandateNotesByField): a standard's own `sampling_overrides`
// has no serving counterpart, so no selected standard ever mandates a
// serving field.
import type { CheckpointListItem, ServingProfileSummary } from '../../api/client'
import { shortFingerprint } from '../../utils/shortFingerprint'

// GET /serving-profiles returns ad-hoc rows too (label === null) --
// this card offers a submit-time choice of a *named* profile plus,
// when `profileChoice` already points at an unlabelled one (Re-run
// prefill from a run that used an ad-hoc profile), that one row too.
// Mirrors CheckpointSamplingCard.helper.ts's own samplingProfileOptions.
export function servingProfileOptions(
  profileChoice: number | null,
  servingProfiles: ServingProfileSummary[],
  servingProfilesById: Map<number, ServingProfileSummary>,
): ServingProfileSummary[] {
  const named = servingProfiles.filter((profile) => profile.label !== null)
  const chosen = profileChoice === null ? undefined : servingProfilesById.get(profileChoice)
  if (chosen === undefined || chosen.label !== null) {
    return named
  }
  return [...named, chosen]
}

// Mirrors CheckpointSamplingCard.helper.ts's own samplingProfileOptionLabel.
export function servingProfileOptionLabel(profile: ServingProfileSummary): string {
  return profile.label ?? `Custom (${shortFingerprint(profile.hash)})`
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
  const name = checkpoint.serving_profile_label ?? `Custom (${shortFingerprint(checkpoint.serving_profile_hash)})`
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
