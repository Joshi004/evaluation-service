// The 8-character prefix of a content hash -- §4.3's "Fingerprint":
// short enough to sit in a chip, long enough that two different
// standards or profiles essentially never collide on it in this
// catalog's size. FingerprintChip and setupLabel's unlabelled-profile
// fallback both read through this one function.
export function shortFingerprint(hash: string): string {
  return hash.slice(0, 8)
}
