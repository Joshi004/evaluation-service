// Non-DOM logic for DryRunPreview.tsx: stringifying the `unknown`
// before/after values in a FieldChange, and collapsing repeated
// compatibility findings across the grid's pairs into one line each.
//
// before/after values are `unknown` rather than a narrower type because
// a standard or sampling field's value is genuinely dynamic across
// fields -- a float for temperature, a dict for extraction
// (app/schemas/runs.py's FieldChange) -- so this narrows before
// formatting instead of assuming a shape.
import type { CompatibilityFinding, RunPreviewPair } from '../../api/client'
import { SAMPLING_OVERRIDE_LABELS } from '../../pages/StandardsPage.helper'

export function formatPreviewValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

// A sparse sampling-overrides object (a standard's own
// `sampling_overrides`, or a submit's own `SamplingOverrides` draft) as
// one line of "field: value" pairs -- the same label set
// StandardsPage.helper.ts already defines, so a resolved-sampling
// card's "standard mandates" / "you changed" lines never disagree with
// the Standards page's own rendering of the same field names.
export function formatSamplingOverrides(overrides: Record<string, unknown>): string {
  const entries = Object.entries(overrides)
  if (entries.length === 0) {
    return 'none'
  }
  return entries
    .map(([field, value]) => `${SAMPLING_OVERRIDE_LABELS[field] ?? field}: ${formatPreviewValue(value)}`)
    .join(', ')
}

// One comparison_hash per (checkpoint, standard) pair, keyed the same
// way a resolved-sampling entry already is -- RunPreviewPair carries
// the hash, ResolvedSamplingPreview doesn't repeat it, so a resolved-
// sampling card looks it up here rather than the backend sending it
// twice.
export function comparisonHashByPair(pairs: RunPreviewPair[]): Map<string, string> {
  const hashByPairKey = new Map<string, string>()
  for (const pair of pairs) {
    hashByPairKey.set(`${pair.checkpoint_id}-${pair.standard_id}`, pair.comparison_hash)
  }
  return hashByPairKey
}

export interface GroupedFinding extends CompatibilityFinding {
  // Every pair this exact finding applies to, as "checkpoint × standard"
  // -- more than one entry is what a repeated finding collapsed from.
  pairLabels: string[]
}

function pairLabel(pair: RunPreviewPair): string {
  return `${pair.checkpoint_name} × ${pair.standard_label ?? pair.benchmark}`
}

// Collapses one finding repeated across many pairs (a 3x6 grid with one
// bad standard shouldn't print eighteen identical lines) into one
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
