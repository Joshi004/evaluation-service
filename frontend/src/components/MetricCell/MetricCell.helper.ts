// A stable recipe_hash -> HSL hue mapping, so the same recipe always
// renders the same colour with no lookup table to maintain. `% 360`
// keeps the result in valid hue range; the multiplier (31, a small odd
// prime) just spreads similar hashes across the colour wheel instead of
// clustering them.
export function hashToHue(recipeHash: string): number {
  let hash = 0
  for (const char of recipeHash) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360
  }
  return hash
}
