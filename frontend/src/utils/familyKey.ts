// Normalises a checkpoint's `family` string for grouping -- stored
// family spellings are inconsistent in real data ("QWen3.5" vs
// "Qwen-3.5"), which splits one family into two groups unless every
// grouping site normalises the same way. Lower-case, alphanumerics
// only: familyKey("QWen3.5") === familyKey("Qwen-3.5").
export function familyKey(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]/g, '')
}
