// A serving profile's own label-or-hash (Trap: an ad-hoc customisation
// has label=null, so the hash is the only thing that identifies it --
// app/models/serving_profile.py, R-D16). Mirrors standardDisplayName.ts's
// same fallback rule for standards.
export function servingProfileDisplayName(
  servingProfileLabel: string | null,
  servingProfileHash: string,
): string {
  return servingProfileLabel ?? servingProfileHash
}
