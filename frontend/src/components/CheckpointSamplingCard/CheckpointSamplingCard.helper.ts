// Non-DOM logic for CheckpointSamplingCard.tsx.
import type { CheckpointListItem, SamplingProfileSummary, StandardSummary } from '../../api/client'
import { formatPreviewValue } from '../DryRunPreview/DryRunPreview.helper'
import { shortFingerprint } from '../../utils/shortFingerprint'
import { standardDisplayName } from '../../utils/standardDisplayName'

// GET /sampling-profiles returns ad-hoc rows too (label === null) --
// this card offers a submit-time choice of a *named* profile plus,
// when `profileChoice` already points at an unlabelled one (Re-run
// prefill from a run that used an ad-hoc profile -- Phase 10,
// docs/UI_REDESIGN_PLAN.md §8.10's own `from` handling), that one row
// too, so the select always has an option matching its own current
// value. Mirrors the old grid-wide SamplingProfilePicker's same
// named-only rule (SamplingProfilePicker.helper.ts) for every profile
// but the chosen one.
export function samplingProfileOptions(
  profileChoice: number | null,
  samplingProfiles: SamplingProfileSummary[],
  samplingProfilesById: Map<number, SamplingProfileSummary>,
): SamplingProfileSummary[] {
  const named = samplingProfiles.filter((profile) => profile.label !== null)
  const chosen = profileChoice === null ? undefined : samplingProfilesById.get(profileChoice)
  if (chosen === undefined || chosen.label !== null) {
    return named
  }
  return [...named, chosen]
}

// An option's own label -- a named profile shows its label unchanged;
// the one unlabelled profile samplingProfileOptions above can add shows
// its fingerprint instead, the same "never show the raw hash" rule
// FingerprintChip already follows, just inline here since a <select>
// option can't render a real FingerprintChip.
export function samplingProfileOptionLabel(profile: SamplingProfileSummary): string {
  return profile.label ?? `Custom (${shortFingerprint(profile.hash)})`
}

// This checkpoint's base sampling profile: whichever one this card's
// picker explicitly chose, or the checkpoint's own registered default
// otherwise (S-D9). Null only while `/sampling-profiles` is still
// loading -- default_sampling_profile_id is a NOT NULL foreign key, so
// a fully loaded list always has an entry for it.
export function resolveBaseSamplingProfile(
  checkpoint: CheckpointListItem,
  profileChoice: number | null,
  samplingProfilesById: Map<number, SamplingProfileSummary>,
): SamplingProfileSummary | null {
  const profileId = profileChoice ?? checkpoint.default_sampling_profile_id
  return samplingProfilesById.get(profileId) ?? null
}

export function defaultProfileOptionLabel(checkpoint: CheckpointListItem): string {
  const name = samplingProfileOptionLabelFromParts(
    checkpoint.default_sampling_profile_label,
    checkpoint.default_sampling_profile_hash,
  )
  return `Its registered default (${name})`
}

function samplingProfileOptionLabelFromParts(label: string | null, hash: string): string {
  return label ?? `Custom (${shortFingerprint(hash)})`
}

// One combined note per sampling field that at least one selected
// standard's own `sampling_overrides` mandates -- e.g. "gsm8k/v1
// mandates 0". Shown under that field since the mandate wins over this
// card's own value unless the caller overrides it too
// (`merge_sampling_config`, app/services/runs/submit.py, applies the
// mandate after the base profile and before the user's own override).
// Empty for every standard in the catalog today -- Phase 3 moved
// sampling off `standard` almost entirely -- but kept correct rather
// than assumed permanently empty.
export function samplingMandateNotesByField(standards: StandardSummary[]): Map<string, string> {
  const messagesByField = new Map<string, string[]>()
  for (const standard of standards) {
    for (const [field, value] of Object.entries(standard.sampling_overrides)) {
      const standardName = standardDisplayName(standard.label, standard.hash)
      const messages = messagesByField.get(field) ?? []
      messages.push(`${standardName} mandates ${formatPreviewValue(value)}`)
      messagesByField.set(field, messages)
    }
  }
  return new Map(
    [...messagesByField.entries()].map(([field, messages]) => [field, messages.join('; ')]),
  )
}
