import type { CatalogEntryState, CatalogEntryStatus } from '../../api/client'
import { useCatalogStatus } from '../../api/queries/catalog'
import type { CatalogResourceDescriptor } from '../../utils/catalogResources'
import { CATALOG_STATE_HINTS, CATALOG_STATE_LABELS } from '../../utils/labels'
import { Badge } from '../Badge/Badge'
import { CatalogDeleteButton } from '../CatalogDeleteButton/CatalogDeleteButton'
import { CatalogPruneButton } from '../CatalogPruneButton/CatalogPruneButton'
import { CatalogReloadButton } from '../CatalogReloadButton/CatalogReloadButton'
import { EmptyState } from '../EmptyState/EmptyState'
import { ErrorState } from '../ErrorState/ErrorState'
import { Skeleton } from '../Skeleton/Skeleton'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { Tooltip } from '../Tooltip/Tooltip'
import { catalogEntryBadgeTone, catalogEntryDisplayName, catalogEntryKey, sortEntriesByAttentionFirst } from './CatalogPanel.helper'

interface CatalogPanelProps {
  resource: CatalogResourceDescriptor
}

// Every state, in a fixed reading order -- not derived from whichever
// states happen to appear today, so the legend below doesn't reshuffle
// as the catalog's own contents change.
const STATE_LEGEND_ORDER: CatalogEntryState[] = ['loaded', 'new', 'conflicting', 'orphaned', 'ad_hoc', 'invalid']

// The shared shell every catalog's own "Manage" drawer opens (S-D32):
// the entry list from catalog-status, Reload, Prune, and per-row
// Delete. One component, three usages (via ManageCatalogButton),
// because three near-identical drawers would drift the way three
// loaders would (docs/STANDARDS_AND_PROFILES_PHASES.md Phase 7).
// Restyled onto tokens and primitives in Phase 12
// (docs/UI_REDESIGN_PLAN.md §8.12): no more renderRowValues (browsing
// a row's full field values now happens on its own detail page, not
// here) and no more window.confirm (every mutation below opens
// through its own ConfirmDialog button).
export function CatalogPanel({ resource }: CatalogPanelProps) {
  const status = useCatalogStatus(resource)
  const entries = status.data ? sortEntriesByAttentionFirst(status.data.entries) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Catalog files</h3>
        <div className="flex gap-2">
          <CatalogReloadButton resource={resource} />
          <CatalogPruneButton resource={resource} entries={status.data?.entries ?? []} />
        </div>
      </div>

      {status.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {status.isError && (
        <ErrorState
          message="Could not load catalog status"
          details={String(status.error)}
          onRetry={() => status.refetch()}
        />
      )}

      {status.data && entries.length === 0 && <EmptyState message="No catalog files or rows found." />}

      {status.data && entries.length > 0 && (
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>Entry</TableHeaderCell>
              <TableHeaderCell>File</TableHeaderCell>
              <TableHeaderCell>State</TableHeaderCell>
              <TableHeaderCell>Detail</TableHeaderCell>
              <TableHeaderCell />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <CatalogEntryRow key={catalogEntryKey(entry)} entry={entry} resource={resource} />
            ))}
          </tbody>
        </Table>
      )}

      <details>
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          What these states mean
        </summary>
        <ul className="mt-2 space-y-2">
          {STATE_LEGEND_ORDER.map((state) => (
            <li key={state} className="flex items-baseline gap-2 text-xs">
              <Badge tone={catalogEntryBadgeTone(state)} className="shrink-0">
                {CATALOG_STATE_LABELS[state]}
              </Badge>
              <span className="text-muted-foreground">{CATALOG_STATE_HINTS[state]}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

interface CatalogEntryRowProps {
  entry: CatalogEntryStatus
  resource: CatalogResourceDescriptor
}

function CatalogEntryRow({ entry, resource }: CatalogEntryRowProps) {
  const name = catalogEntryDisplayName(entry)
  return (
    <tr>
      <TableCell>{name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{entry.file ?? '—'}</TableCell>
      <TableCell>
        <Tooltip content={CATALOG_STATE_HINTS[entry.state]}>
          <span tabIndex={0}>
            <Badge tone={catalogEntryBadgeTone(entry.state)}>{CATALOG_STATE_LABELS[entry.state]}</Badge>
          </span>
        </Tooltip>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{entry.detail ?? '—'}</TableCell>
      <TableCell className="text-right">
        {entry.row_id !== null && (
          <CatalogDeleteButton resource={resource} rowId={entry.row_id} name={name} deletable={entry.deletable} />
        )}
      </TableCell>
    </tr>
  )
}
