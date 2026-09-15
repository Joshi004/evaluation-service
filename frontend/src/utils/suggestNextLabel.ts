// Suggests a label for a customisation an override card is about to
// mint -- offered once a card has at least one changed field
// (StandardOverrideCard.tsx, CheckpointSamplingCard.tsx,
// CheckpointServingCard.tsx), so naming it is a single accepted
// suggestion rather than free-form typing from a blank box.
//
// Rule: strip a trailing `-NN` off the base name to get its family
// root, find the highest `-NN` already taken within that family, and
// suggest the next one, zero-padded to two digits -- 'greedy' with
// nothing taken suggests 'greedy-01'; with 'greedy-02' already taken,
// 'greedy-03'. A base name with no numeric suffix of its own (the usual
// case) is its own root unchanged.

const TRAILING_NUMERIC_SUFFIX = /-(\d+)$/

function familyRoot(baseName: string): string {
  return baseName.replace(TRAILING_NUMERIC_SUFFIX, '')
}

// Escapes RegExp special characters so a base name that happens to
// contain one (a checkpoint or benchmark name could, in principle)
// doesn't change what the sibling-suffix pattern below matches.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// `takenLabels` is the catalog's existing labels for this resource plus
// whatever this same submit has already claimed for a sibling card --
// the caller (SubmitOverrides.tsx) accumulates that second part itself,
// adding each card's accepted suggestion before computing the next, so
// two checkpoints both defaulting to 'greedy' suggest 'greedy-01' and
// 'greedy-02' rather than the same name twice.
export function suggestNextLabel(baseName: string, takenLabels: ReadonlySet<string>): string {
  const root = familyRoot(baseName)
  const siblingSuffixPattern = new RegExp(`^${escapeRegExp(root)}-(\\d+)$`)

  let highestSuffix = 0
  for (const label of takenLabels) {
    const match = siblingSuffixPattern.exec(label)
    if (match !== null) {
      highestSuffix = Math.max(highestSuffix, Number(match[1]))
    }
  }

  const nextSuffix = String(highestSuffix + 1).padStart(2, '0')
  return `${root}-${nextSuffix}`
}
