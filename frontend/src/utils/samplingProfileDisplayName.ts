// A sampling profile's own label-or-hash (an ad-hoc customisation has
// label=null, so the hash is the only thing that identifies it --
// app/models/sampling_profile.py). Mirrors servingProfileDisplayName.ts's
// same fallback rule for serving profiles.
export function samplingProfileDisplayName(
  samplingProfileLabel: string | null,
  samplingProfileHash: string,
): string {
  return samplingProfileLabel ?? samplingProfileHash
}
