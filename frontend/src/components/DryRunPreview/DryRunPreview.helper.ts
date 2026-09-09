// Non-DOM logic for DryRunPreview.tsx: stringifying the `unknown`
// before/after values in a ResolvedRecipePreview's changed_fields, and
// collapsing repeated compatibility findings across the grid's pairs
// into one line each.
//
// before/after values are `unknown` rather than a narrower type because
// a recipe field's value is genuinely dynamic across fields -- a float
// for temperature, a dict for extraction (app/schemas/runs.py's
// RecipeFieldChange) -- so this narrows before formatting instead of
// assuming a shape.
import type { CompatibilityFinding, RunPreviewPair } from '../../api/client'

export function formatPreviewValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

export interface GroupedFinding extends CompatibilityFinding {
  // Every pair this exact finding applies to, as "checkpoint × recipe"
  // -- more than one entry is what a repeated finding collapsed from.
  pairLabels: string[]
}

function pairLabel(pair: RunPreviewPair): string {
  return `${pair.checkpoint_name} × ${pair.recipe_label ?? pair.benchmark}`
}

// Collapses one finding repeated across many pairs (a 3x6 grid with one
// bad recipe shouldn't print eighteen identical lines) into one
// GroupedFinding with every affected pair listed. Grouped on
// code+field+message together, not code alone, because a rule's
// message can embed per-pair values -- checkpoint_unavailable names the
// checkpoint -- and a code-only group would silently merge those into
// one misleading line instead of keeping them apart.
export function groupFindingsByCode(
  pairs: RunPreviewPair[],
  severity: 'errors' | 'warnings',
): GroupedFinding[] {
  const groupsByKey = new Map<string, GroupedFinding>()

  for (const pair of pairs) {
    for (const finding of pair[severity]) {
      const key = JSON.stringify([finding.code, finding.field, finding.message])
      const existingGroup = groupsByKey.get(key)
      if (existingGroup) {
        existingGroup.pairLabels.push(pairLabel(pair))
      } else {
        groupsByKey.set(key, { ...finding, pairLabels: [pairLabel(pair)] })
      }
    }
  }

  return [...groupsByKey.values()]
}
