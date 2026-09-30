// UI vocabulary in one place (docs/UI_REDESIGN_PLAN.md §4.3) -- every
// screen showing a run's status, a checkpoint's weights, or a catalog
// entry's sync state reads its wording from here, so the same state
// never gets worded two different ways on two different pages.
import type { CatalogEntryState } from '../api/client'

export const RUN_STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

// Mirrors the four checkpoint availability_status values
// (app/models/checkpoint.py's CheckConstraint). 'Missing' replaces the
// old literal 'Unavailable' -- §4.3's own vocabulary table.
export const WEIGHTS_STATUS_LABELS: Record<string, string> = {
  unknown: 'Not checked',
  available: 'Available',
  incomplete: 'Incomplete',
  unavailable: 'Missing',
}

// Mirrors every CatalogEntryState the loader can report
// (backend/app/services/catalog/loader.py) -- verified against that
// file, not guessed from §4.3 alone. §4.3 proposed "File removed" for
// `orphaned`, but the loader's own docstring says that state also
// covers a row that was named directly at submit time and never had a
// file, so the label names neither reason rather than picking the
// wrong one.
export const CATALOG_STATE_LABELS: Record<CatalogEntryState, string> = {
  loaded: 'In sync',
  new: 'Not loaded yet',
  conflicting: 'Edited since loaded',
  orphaned: 'Named, no file',
  ad_hoc: 'Custom (no file)',
  invalid: 'Invalid file',
}

// One-line explanations for each catalog state (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12) -- shown in the Manage catalog
// drawer's own legend and in each state badge's tooltip, verified
// against backend/app/services/catalog/loader.py the same way
// CATALOG_STATE_LABELS above already was.
export const CATALOG_STATE_HINTS: Record<CatalogEntryState, string> = {
  loaded: "The database already holds this file's exact content.",
  new: 'No row has this file\u2019s content yet. Reload adds it.',
  conflicting:
    'This label already belongs to a row with different content. Rows never change: give the file a new version label, then reload.',
  orphaned: 'A named row with no file behind it: its file was removed, or it was named when submitted.',
  ad_hoc: 'Made from a one-off customisation, so it never had a file. Prune removes unused ones.',
  invalid: "This file failed validation and can't be loaded. The detail below names the problem.",
}

// A model server (app/models/endpoint.py) has no status column of its
// own -- `url IS NOT NULL` is the entire signal (Endpoint's own
// reuse-check docstring), so these two labels are what that
// distinction is called on screen (Phase 13, docs/UI_REDESIGN_PLAN.md
// §8.13).
export const MODEL_SERVER_STATUS_LABELS = {
  serving: 'Serving',
  starting: 'Starting',
} as const

// One-line explanations for jargon that appears in the UI (§3 rule 10:
// "jargon gets a one-line tooltip"). Keyed loosely by concept, not by
// every place a term appears.
export const TERM_HINTS = {
  setup: 'Results with the same setup are directly comparable.',
  fingerprint:
    'A content fingerprint -- identical fingerprints were produced by the exact same configuration.',
  marginOfError:
    '95% confidence interval from the sample count. Differences inside this range are not reliable.',
} as const
