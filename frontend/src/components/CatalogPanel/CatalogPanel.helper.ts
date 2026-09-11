// Non-DOM logic for CatalogPanel.tsx: the state-to-pill mapping, the
// label-or-hash-or-file display name, and the prune preflight -- kept
// here so CatalogPanel.tsx only renders.
import type { CatalogEntryState, CatalogEntryStatus } from '../../api/client'

interface CatalogEntryBadgeStyle {
  label: string
  className: string
}

// Mirrors StatusBadge.helper.ts / AvailabilityBadge.helper.ts's palette
// so every state pill in the app reads the same way (Phase 7 Build
// item 2): `loaded` is neutral, `new` is blue, `orphaned` is amber, and
// `conflicting`/`invalid` both need a person, which is why they share
// red. `ad_hoc` gets its own dim slate, distinct from `loaded` --
// S-D33 wants ad-hoc rows visually secondary, not indistinguishable
// from a reviewed one.
const CATALOG_ENTRY_BADGES: Record<CatalogEntryState, CatalogEntryBadgeStyle> = {
  loaded: { label: 'Loaded', className: 'bg-slate-700/60 text-slate-300' },
  new: { label: 'New', className: 'bg-blue-500/20 text-blue-300' },
  ad_hoc: { label: 'Ad hoc', className: 'bg-slate-800/60 text-slate-500' },
  orphaned: { label: 'Orphaned', className: 'bg-amber-500/20 text-amber-300' },
  conflicting: { label: 'Conflicting', className: 'bg-red-500/20 text-red-300' },
  invalid: { label: 'Invalid', className: 'bg-red-500/20 text-red-300' },
}

export function catalogEntryBadge(state: CatalogEntryState): CatalogEntryBadgeStyle {
  return CATALOG_ENTRY_BADGES[state]
}

// The label-or-hash rule (utils/servingProfileDisplayName.ts,
// utils/standardDisplayName.ts) extended with the two states that have
// neither: `new` always has a label (it parsed from the YAML), but
// falls through to the filename if somehow absent; `ad_hoc` has no
// label by definition, so its hash is what identifies it (S-D33).
export function catalogEntryDisplayName(entry: CatalogEntryStatus): string {
  return entry.label ?? entry.row_hash ?? entry.file ?? '(unlabelled)'
}

// A stable React key across every state. `row_id` is null only for
// `new`/`invalid` entries, which always have a filename (they came from
// scanning a file); `orphaned`/`ad_hoc` entries always have a row_id.
// The fallback chain never actually reaches 'unknown' -- it exists so
// the return type stays `string` without a cast.
export function catalogEntryKey(entry: CatalogEntryStatus): string {
  if (entry.row_id !== null) {
    return `row-${entry.row_id}`
  }
  return `file-${entry.file ?? entry.label ?? 'unknown'}`
}

// The exact set POST /{resource}/prune will remove: every ad-hoc row
// catalog-status already marked deletable. There is no prune preflight
// route (Phase 6 didn't add one) -- catalog-status already carries
// everything needed to compute the same set client-side, so the confirm
// text and the button's count can never disagree with what the server
// is about to do.
export function prunableRowIds(entries: CatalogEntryStatus[]): number[] {
  const rowIds: number[] = []
  for (const entry of entries) {
    if (entry.state === 'ad_hoc' && entry.deletable && entry.row_id !== null) {
      rowIds.push(entry.row_id)
    }
  }
  return rowIds
}

// Prune's confirm text, naming the exact ids about to go (S-T26's
// "never 'some rows'" rule, applied to prune as well as delete).
export function describePrune(rowIds: number[], entryNoun: string): string {
  return `Prune ${rowIds.length} unlabelled ${entryNoun}(s) with id ${rowIds.join(', ')}? This cannot be undone.`
}
