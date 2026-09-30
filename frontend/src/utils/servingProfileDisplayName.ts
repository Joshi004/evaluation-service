import { shortFingerprint } from './shortFingerprint'

// A serving profile's own label, or else a short "Custom (<hash
// prefix>)" fallback (Trap: an ad-hoc customisation has label=null, so
// the hash is the only thing that identifies it -- app/models/
// serving_profile.py, R-D16). Mirrors standardDisplayName.ts's same
// fallback rule for standards. 'Custom' matches CATALOG_STATE_LABELS'
// own wording for the same ad-hoc, no-label concept (labels.ts).
export function servingProfileDisplayName(
  servingProfileLabel: string | null,
  servingProfileHash: string,
): string {
  return servingProfileLabel ?? `Custom (${shortFingerprint(servingProfileHash)})`
}
