// One descriptor per catalog (standards, sampling-profiles,
// serving-profiles) -- the wording and query key each of the three
// catalog-admin pieces (ManageCatalogButton, CatalogHealthBanner, the
// restyled CatalogPanel) needs, so a page reaches for one object
// instead of repeating its resource path, noun and list query key at
// every call site (Phase 12, docs/UI_REDESIGN_PLAN.md §8.12). Mirrors
// why load_catalog/catalog_status take a CatalogRepository rather than
// three near-identical functions on the backend.
import type { CatalogEntryState, CatalogEntryStatus } from '../api/client'
import { queryKeys } from '../api/queries/queryKeys'

export interface CatalogResourceDescriptor {
  resourcePath: '/standards' | '/sampling-profiles' | '/serving-profiles'
  // Singular, used in "Delete {noun} {name}?" and prune's "Prune N
  // unlabelled {noun}(s)…" text (S-T26's "never 'some rows'" rule).
  noun: string
  // Plural, used as this catalog's own drawer/section title ("Manage
  // {pluralNoun}").
  pluralNoun: string
  // What Reload actually does to an existing row, shown in
  // CatalogReloadButton's own confirmation -- differs per catalog
  // (loader.py's sync_unhashed_columns): a standard's unhashed fields
  // (name, description, category, batch size, timeout) refresh in
  // place from its file; a profile has no unhashed fields, so an
  // existing row never changes.
  reloadDescription: string
  listQueryKey: readonly unknown[]
}

export const CATALOG_RESOURCES = {
  standards: {
    resourcePath: '/standards',
    noun: 'benchmark version',
    pluralNoun: 'benchmarks',
    reloadDescription:
      "Re-scans catalog/standards/ for new or changed files. A file whose content already matches a row is skipped; a new one is added. Every existing row's name, description, category, batch size and timeout refresh in place from its file.",
    listQueryKey: queryKeys.standards(),
  },
  samplingProfiles: {
    resourcePath: '/sampling-profiles',
    noun: 'sampling profile',
    pluralNoun: 'sampling profiles',
    reloadDescription:
      'Re-scans catalog/sampling-profiles/ for new or changed files. A file whose content already matches a row is skipped; a new one is added. Existing rows never change -- profiles have no fields that update in place.',
    listQueryKey: queryKeys.samplingProfiles(),
  },
  servingProfiles: {
    resourcePath: '/serving-profiles',
    noun: 'serving profile',
    pluralNoun: 'serving profiles',
    reloadDescription:
      'Re-scans catalog/serving-profiles/ for new or changed files. A file whose content already matches a row is skipped; a new one is added. Existing rows never change -- profiles have no fields that update in place.',
    listQueryKey: queryKeys.servingProfiles(),
  },
} as const satisfies Record<string, CatalogResourceDescriptor>

// States that need someone to look at a catalog file: `new` (a file
// nobody's reloaded yet), `conflicting` (a file whose label collides
// with a different row) and `invalid` (a file that failed validation).
// `ad_hoc` and `orphaned` are excluded on purpose -- both are the
// normal, permanent result of a customised submit or a direct
// registration (loader.py's own _status_for_unclaimed_row), not
// something to flag every time the page loads. Confirmed against a
// live catalog-status call: this deployment always carries at least
// one ad_hoc row and one orphaned row, neither of which is a problem.
const CATALOG_ATTENTION_STATES: ReadonlySet<CatalogEntryState> = new Set(['new', 'conflicting', 'invalid'])

export function entryNeedsAttention(entry: CatalogEntryStatus): boolean {
  return CATALOG_ATTENTION_STATES.has(entry.state)
}
