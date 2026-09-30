import type { CatalogEntryState, CatalogEntryStatus } from '../../api/client'
import { entryNeedsAttention } from '../../utils/catalogResources'
import { CATALOG_STATE_LABELS } from '../../utils/labels'

export interface CatalogAttentionSummary {
  count: number
  breakdown: string
}

// Groups the entries needing attention by state and writes "N {label,
// lowercased}" per state (e.g. "1 not loaded yet"), joined the same
// way protocolSummary.ts and samplingSummary.ts join their own parts
// -- ' · ' between each. `null` when nothing needs attention, which is
// CatalogHealthBanner's own "render nothing" signal.
export function summarizeAttention(entries: CatalogEntryStatus[]): CatalogAttentionSummary | null {
  const needingAttention = entries.filter((entry) => entryNeedsAttention(entry))
  if (needingAttention.length === 0) {
    return null
  }

  const countByState = new Map<CatalogEntryState, number>()
  for (const entry of needingAttention) {
    countByState.set(entry.state, (countByState.get(entry.state) ?? 0) + 1)
  }

  const parts = [...countByState.entries()].map(
    ([state, count]) => `${count} ${CATALOG_STATE_LABELS[state].toLowerCase()}`,
  )

  return { count: needingAttention.length, breakdown: parts.join(' \u00b7 ') }
}
