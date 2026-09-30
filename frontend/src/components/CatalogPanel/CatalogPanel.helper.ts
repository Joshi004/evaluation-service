// Non-DOM logic for CatalogPanel.tsx: the state-to-badge-tone mapping,
// the label-or-hash-or-file display name, a stable React key, sorting
// entries so the ones needing attention lead, and the prune preflight.
import type { CatalogEntryState, CatalogEntryStatus } from '../../api/client'
import { entryNeedsAttention } from '../../utils/catalogResources'
import type { BadgeTone } from '../Badge/Badge.helper'

// Mirrors CATALOG_STATE_LABELS' (utils/labels.ts) states with the tone
// each reads as: `loaded` and `ad_hoc` are both unremarkable
// (neutral), `new` is informational, `orphaned` a soft warning, and
// `conflicting`/`invalid` both need a person (danger) -- the same
// three states entryNeedsAttention flags.
const CATALOG_ENTRY_BADGE_TONES: Record<CatalogEntryState, BadgeTone> = {
  loaded: 'neutral',
  new: 'info',
  ad_hoc: 'neutral',
  orphaned: 'warning',
  conflicting: 'danger',
  invalid: 'danger',
}

export function catalogEntryBadgeTone(state: CatalogEntryState): BadgeTone {
  return CATALOG_ENTRY_BADGE_TONES[state]
}

// The label-or-hash rule (utils/servingProfileDisplayName.ts,
// utils/standardDisplayName.ts) extended with the two states that have
// neither: `new` always has a label (it parsed from the YAML), but
// falls through to the filename if somehow absent; `ad_hoc` has no
// label by definition, so its hash is what identifies it.
export function catalogEntryDisplayName(entry: CatalogEntryStatus): string {
  return entry.label ?? entry.row_hash ?? entry.file ?? '(unlabelled)'
}

// A stable React key across every state. Keyed on the file name first,
// not `row_id`: two different files can validate to the exact same
// content (differing only in label or comments, neither of which
// participates in the content hash) and both resolve to the very same
// existing row, so two catalog-status entries can legitimately share
// one row_id (confirmed live: sampling-profiles' lfm2_5_think.yaml and
// qwen3_think.yaml both report row_id 2). A directory scan can never
// produce two files with the same name, so keying on the file first is
// always unique for a file-backed entry (new/loaded/conflicting/
// invalid). Only orphaned/ad_hoc entries have no file -- and only those
// reach the row_id fallback, where it genuinely is unique (loader.py's
// own unclaimed-row pass never revisits a row a file already claimed).
export function catalogEntryKey(entry: CatalogEntryStatus): string {
  if (entry.file !== null) {
    return `file-${entry.file}`
  }
  return `row-${entry.row_id}`
}

// Attention-needing entries first, in the order catalog-status
// returned them; everything else follows, also in that same order --
// so the handful of rows someone actually needs to act on are never
// buried below a long list of loaded/orphaned/ad-hoc ones.
export function sortEntriesByAttentionFirst(entries: CatalogEntryStatus[]): CatalogEntryStatus[] {
  const needsAttention = entries.filter((entry) => entryNeedsAttention(entry))
  const everythingElse = entries.filter((entry) => !entryNeedsAttention(entry))
  return [...needsAttention, ...everythingElse]
}

// The exact set POST /{resource}/prune will remove: every ad-hoc row
// catalog-status already marked deletable. There is no prune preflight
// route -- catalog-status already carries everything needed to compute
// the same set client-side, so the confirm text and the button's count
// can never disagree with what the server is about to do.
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
export function describePrune(rowIds: number[], noun: string): string {
  const plural = rowIds.length === 1 ? '' : 's'
  return `Removes id ${rowIds.join(', ')}: ${rowIds.length} unlabelled ${noun}${plural} with no other references. This cannot be undone.`
}
