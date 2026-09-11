import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState, type ReactNode } from 'react'
import { apiFetch, type CatalogEntryStatus, type CatalogPruneResult, type CatalogStatus } from '../../api/client'
import {
  catalogEntryBadge,
  catalogEntryDisplayName,
  catalogEntryKey,
  describePrune,
  prunableRowIds,
} from './CatalogPanel.helper'

interface CatalogPanelProps {
  resourcePath: string // '/standards' | '/sampling-profiles' | '/serving-profiles'
  listQueryKey: readonly unknown[] // the page's own value-list key, invalidated after every mutation
  entryNoun: string // 'standard' | 'sampling profile' | 'serving profile'
  // Omitted by StandardsPage (its detail cards below already show every
  // value), supplied by both profile pages so a row can expand into its
  // own value table without leaving the page.
  renderRowValues?: (rowId: number) => ReactNode
}

// The shared shell all three catalog pages use (S-D32): the entry list
// from catalog-status, Reload, Prune, and per-row Delete. One
// component, three usages, because three near-identical pages would
// drift the way three loaders would (docs/STANDARDS_AND_PROFILES_PHASES.md
// Phase 7).
export function CatalogPanel({ resourcePath, listQueryKey, entryNoun, renderRowValues }: CatalogPanelProps) {
  const queryClient = useQueryClient()
  const [expandedRowIds, setExpandedRowIds] = useState<number[]>([])
  const statusQueryKey = ['catalog-status', resourcePath]

  const status = useQuery({
    queryKey: statusQueryKey,
    queryFn: () => apiFetch<CatalogStatus>(`${resourcePath}/catalog-status`),
  })

  // Every mutation below changes both what catalog-status would report
  // and what the page's own value list holds, so both queries need to
  // be invalidated together -- never just one, or the panel and the
  // page it sits above could disagree about whether a row still exists.
  function invalidateAfterMutation() {
    queryClient.invalidateQueries({ queryKey: statusQueryKey })
    queryClient.invalidateQueries({ queryKey: listQueryKey })
  }

  // The reload response (the resource's own summary list) isn't read --
  // invalidating the two queries above is what refreshes the screen, so
  // this mutation exists purely to trigger the POST and report failure.
  const reloadMutation = useMutation({
    mutationFn: () => apiFetch<unknown[]>(`${resourcePath}/reload`, { method: 'POST' }),
    onSuccess: invalidateAfterMutation,
  })

  const pruneMutation = useMutation({
    mutationFn: () => apiFetch<CatalogPruneResult>(`${resourcePath}/prune`, { method: 'POST' }),
    onSuccess: invalidateAfterMutation,
  })

  // One mutation instance shared by every row's Delete button, the same
  // pattern CheckpointDetailPage's "Check availability" button uses
  // (S-T30): TanStack keeps the last mutate() argument on `variables`
  // even after it settles, which is what a per-row pending/error state
  // needs without a second piece of state to keep in sync.
  const deleteMutation = useMutation({
    mutationFn: (rowId: number) => apiFetch<void>(`${resourcePath}/${rowId}`, { method: 'DELETE' }),
    onSuccess: invalidateAfterMutation,
  })
  const deletingRowId = deleteMutation.isPending ? deleteMutation.variables : null

  const entries = status.data?.entries ?? []
  const prunableIds = prunableRowIds(entries)

  function toggleExpanded(rowId: number) {
    setExpandedRowIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId],
    )
  }

  function handleDelete(entry: CatalogEntryStatus) {
    if (entry.row_id === null) {
      return
    }
    const name = catalogEntryDisplayName(entry)
    if (window.confirm(`Delete ${entryNoun} ${name}? Catalog rows are immutable; this cannot be undone.`)) {
      deleteMutation.mutate(entry.row_id)
    }
  }

  function handlePrune() {
    if (prunableIds.length === 0 || !window.confirm(describePrune(prunableIds, entryNoun))) {
      return
    }
    pruneMutation.mutate()
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-slate-100">Catalog</h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={reloadMutation.isPending}
            onClick={() => reloadMutation.mutate()}
            className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {reloadMutation.isPending ? 'Reloading…' : 'Reload'}
          </button>
          <button
            type="button"
            disabled={pruneMutation.isPending || prunableIds.length === 0}
            onClick={handlePrune}
            className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {pruneMutation.isPending
              ? 'Pruning…'
              : prunableIds.length === 0
                ? 'Nothing to prune'
                : `Prune (${prunableIds.length})`}
          </button>
        </div>
      </header>

      {status.isLoading && <p className="mt-3 text-sm text-slate-500">Loading catalog status…</p>}

      {status.isError && (
        <p className="mt-3 text-sm text-red-400">Could not load catalog status: {String(status.error)}</p>
      )}

      {reloadMutation.isError && (
        <p className="mt-3 text-sm text-red-400">Reload failed: {String(reloadMutation.error)}</p>
      )}

      {pruneMutation.isError && (
        <p className="mt-3 text-sm text-red-400">Prune failed: {String(pruneMutation.error)}</p>
      )}

      {pruneMutation.isSuccess && (
        <p className="mt-3 text-sm text-emerald-400">
          {pruneMutation.data.deleted_ids.length === 0
            ? 'Nothing was removed -- every candidate had already gained a reference.'
            : `Removed ${entryNoun}(s) with id ${pruneMutation.data.deleted_ids.join(', ')}.`}
        </p>
      )}

      {status.data && entries.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No catalog files or rows found.</p>
      )}

      {status.data && entries.length > 0 && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-6 border-b border-slate-800 p-2" />
              <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Entry</th>
              <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">File</th>
              <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">State</th>
              <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Detail</th>
              <th className="border-b border-slate-800 p-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <CatalogEntryRow
                key={catalogEntryKey(entry)}
                entry={entry}
                isExpanded={entry.row_id !== null && expandedRowIds.includes(entry.row_id)}
                canExpand={renderRowValues !== undefined}
                onToggleExpand={toggleExpanded}
                onDelete={() => handleDelete(entry)}
                isDeleting={entry.row_id !== null && deletingRowId === entry.row_id}
                deleteError={
                  entry.row_id !== null && deleteMutation.isError && deleteMutation.variables === entry.row_id
                    ? String(deleteMutation.error)
                    : null
                }
                renderRowValues={renderRowValues}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

interface CatalogEntryRowProps {
  entry: CatalogEntryStatus
  isExpanded: boolean
  canExpand: boolean
  onToggleExpand: (rowId: number) => void
  onDelete: () => void
  isDeleting: boolean
  deleteError: string | null
  renderRowValues?: (rowId: number) => ReactNode
}

// One row of the catalog table, plus its optional expansion -- kept as
// its own component (rather than inlined in the .map above) for the
// same reason StandardsPage.tsx keeps StandardSection separate: a
// table row with a conditional detail row beneath it is its own clear
// piece of JSX, and CatalogPanel's own body reads as just the panel's
// controls plus the query/mutation wiring.
function CatalogEntryRow({
  entry,
  isExpanded,
  canExpand,
  onToggleExpand,
  onDelete,
  isDeleting,
  deleteError,
  renderRowValues,
}: CatalogEntryRowProps) {
  const badge = catalogEntryBadge(entry.state)
  const rowId = entry.row_id

  return (
    <Fragment>
      <tr>
        <td className="border-b border-slate-800/50 p-2 text-slate-500">
          {canExpand && rowId !== null && (
            <button type="button" onClick={() => onToggleExpand(rowId)} className="text-xs hover:text-slate-200">
              {isExpanded ? '▾' : '▸'}
            </button>
          )}
        </td>
        <td className="border-b border-slate-800/50 p-2 text-slate-200">{catalogEntryDisplayName(entry)}</td>
        <td className="border-b border-slate-800/50 p-2 font-mono text-xs text-slate-400">
          {entry.file ?? '—'}
        </td>
        <td className="border-b border-slate-800/50 p-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </td>
        <td className="border-b border-slate-800/50 p-2 text-xs text-slate-400">{entry.detail ?? '—'}</td>
        <td className="border-b border-slate-800/50 p-2 text-right">
          {rowId !== null && (
            <>
              <button
                type="button"
                disabled={!entry.deletable || isDeleting}
                onClick={onDelete}
                className="rounded border border-red-500/30 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
              {deleteError && <p className="mt-1 text-xs text-red-400">{deleteError}</p>}
            </>
          )}
        </td>
      </tr>
      {isExpanded && renderRowValues && rowId !== null && (
        <tr>
          <td colSpan={6} className="border-b border-slate-800/50 bg-slate-950/40 p-3">
            {renderRowValues(rowId)}
          </td>
        </tr>
      )}
    </Fragment>
  )
}
