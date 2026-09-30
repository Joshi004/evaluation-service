// A one-line "what this profile actually does" summary -- promoted
// from ServingProfilePicker.helper.ts (Phase 11, docs/UI_REDESIGN_PLAN.md
// section 8.11) once a model's own Configuration tab became a second
// caller: the registration wizard's accept/pick options and a model's
// currently-registered profile now read the exact same description,
// so the two can never drift apart.
import type { ServingProfileSummary } from '../api/client'
import { servingProfileDisplayName } from './servingProfileDisplayName'

// The profile's own facts, without its name -- split out of
// describeProfileGlance (Phase 12, docs/UI_REDESIGN_PLAN.md §8.12) once
// the Profiles page's own table needed a "Summary" column next to a
// "Name" column that already shows servingProfileDisplayName, so the
// name would otherwise print twice in the same row.
export function servingSummary(profile: ServingProfileSummary): string {
  const parts = [
    `${profile.engine} ${profile.engine_version}`,
    `${profile.gpus} GPU${profile.gpus === 1 ? '' : 's'}`,
  ]
  if (profile.max_model_len !== null) {
    parts.push(`max_model_len ${profile.max_model_len.toLocaleString()}`)
  }
  if (profile.reasoning_parser !== null) {
    parts.push(`reasoning_parser ${profile.reasoning_parser}`)
  }
  return parts.join(' \u00b7 ')
}

export function describeProfileGlance(profile: ServingProfileSummary): string {
  return [servingProfileDisplayName(profile.label, profile.hash), servingSummary(profile)].join(' \u00b7 ')
}
