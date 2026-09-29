// Non-DOM logic for DryRunPreview.tsx: stringifying the `unknown`
// before/after values in a FieldChange, collapsing repeated
// compatibility findings across the grid's pairs into one line each,
// and turning the preview's own resolved-* arrays into the compact
// "what will be created" list (Phase 10, docs/UI_REDESIGN_PLAN.md
// §8.10 -- the per-pair ResolvedSamplingCard/ResolvedServingCard this
// replaces showed every merge layer; the created list only needs the
// answer, since the Settings step's own setup-alignment line is where
// "will this line up?" now lives).
//
// before/after values are `unknown` rather than a narrower type because
// a standard or sampling field's value is genuinely dynamic across
// fields -- a float for temperature, a dict for extraction
// (app/schemas/runs.py's FieldChange) -- so this narrows before
// formatting instead of assuming a shape.
import type { CompatibilityFinding, RunPreview, RunPreviewPair } from '../../api/client'
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

export interface GroupedFinding extends CompatibilityFinding {
  // Every pair this exact finding applies to, as "checkpoint × standard"
  // -- more than one entry is what a repeated finding collapsed from.
  pairLabels: string[]
}

function pairLabel(pair: RunPreviewPair): string {
  return `${pair.checkpoint_name} × ${pair.standard_label ?? pair.benchmark}`
}

// Collapses one finding repeated across many pairs (several models
// against several benchmarks with one bad standard shouldn't print one
// identical line per pair) into one GroupedFinding with every affected
// pair listed. Grouped on code+field+message together, not code alone,
// because a rule's message can embed per-pair values --
// checkpoint_unavailable names the checkpoint -- and a code-only group
// would silently merge those into one misleading line instead of
// keeping them apart.
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

export interface CreatedItem {
  key: string
  description: string
}

// One line per row a real submit would actually insert -- a standard
// each appears once already (preview_runs loops `base_standards` once,
// outside the checkpoint loop) and a checkpoint's serving likewise
// (looped once per checkpoint, outside the standard loop), but a
// checkpoint's *sampling* is resolved once per (checkpoint, standard)
// pair and very often hashes identically across every standard that
// checkpoint runs against (a standard's own sampling_overrides mandate
// is empty for all five benchmarks today) -- deduping by hash is what
// keeps one real new row from printing once per pair it happens to
// touch.
export function buildCreatedItems(
  preview: RunPreview,
  standardLabelByStandardId: Record<number, string>,
  samplingLabelByCheckpointId: Record<number, string>,
  servingLabelByCheckpointId: Record<number, string>,
): CreatedItem[] {
  const items: CreatedItem[] = []

  for (const resolved of preview.resolved_standards) {
    if (!resolved.is_new_standard) {
      continue
    }
    const label = standardLabelByStandardId[resolved.base_standard_id]
    items.push({
      key: `standard-${resolved.base_standard_id}`,
      description: label ? `New benchmark protocol "${label}"` : 'New benchmark protocol (unlabelled)',
    })
  }

  const seenSamplingHashes = new Set<string>()
  for (const resolved of preview.resolved_sampling) {
    if (!resolved.is_new_sampling_profile || seenSamplingHashes.has(resolved.hash)) {
      continue
    }
    seenSamplingHashes.add(resolved.hash)
    const label = samplingLabelByCheckpointId[resolved.checkpoint_id]
    items.push({
      key: `sampling-${resolved.hash}`,
      description: label ? `New sampling profile "${label}"` : 'New sampling profile (unlabelled)',
    })
  }

  for (const resolved of preview.resolved_serving) {
    if (!resolved.is_new_serving_profile) {
      continue
    }
    const label = servingLabelByCheckpointId[resolved.checkpoint_id]
    items.push({
      key: `serving-${resolved.checkpoint_id}`,
      description: label ? `New serving profile "${label}"` : 'New serving profile (unlabelled)',
    })
  }

  return items
}
