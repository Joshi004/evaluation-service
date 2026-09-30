import { shortFingerprint } from './shortFingerprint'

// A sampling profile's own label-or-hash (an ad-hoc customisation has
// label=null, so the hash is the only thing that identifies it --
// app/models/sampling_profile.py). Mirrors servingProfileDisplayName.ts's
// same fallback rule for serving profiles. 'Custom' matches
// CATALOG_STATE_LABELS' own wording for the same ad-hoc, no-label
// concept (labels.ts).
export function samplingProfileDisplayName(
  samplingProfileLabel: string | null,
  samplingProfileHash: string,
): string {
  return samplingProfileLabel ?? `Custom (${shortFingerprint(samplingProfileHash)})`
}
