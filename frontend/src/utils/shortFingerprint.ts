// The 8-character prefix of a content hash -- short enough to sit in a
// chip, long enough that two different standards or profiles
// essentially never collide on it in this catalog's size.
// FingerprintChip and every unlabelled-profile fallback read through
// this one function.
export function shortFingerprint(hash: string): string {
  return hash.slice(0, 8)
}
