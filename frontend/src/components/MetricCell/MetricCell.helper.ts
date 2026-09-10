// A stable comparison_hash -> HSL hue mapping, so cells produced the
// same way always render the same colour with no lookup table to
// maintain. `% 360` keeps the result in valid hue range; the multiplier
// (31, a small odd prime) just spreads similar hashes across the colour
// wheel instead of clustering them.
export function hashToHue(comparisonHash: string): number {
  let hash = 0
  for (const char of comparisonHash) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360
  }
  return hash
}
