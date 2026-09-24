import { useQuery } from '@tanstack/react-query'
import { apiFetch, type ClusterPartitions } from '../../api/client'
import { buildPartitionOptions, PARTITIONS_CACHE_TTL_MS, readCachedPartitions, writeCachedPartitions } from './PartitionPicker.helper'

interface PartitionPickerProps {
  // Controlled, mirroring ServingProfilePicker's own idiom: `null`
  // means "use this deployment's own default", the same meaning as the
  // request field's absence (CreateRunsRequest.partition,
  // app/api/client.ts) -- an untouched picker must never resolve to
  // some particular partition name the frontend picked on its own.
  value: string | null
  onValueChange: (value: string | null) => void
}

// The Submit page's partition picker (per-run SLURM partition
// selection): fetches the cluster's real partition list -- including a
// hidden, lower-priority one like `background` that never appears in
// SLURM's own unqualified listing commands -- and caches it in
// localStorage so a normal session never re-fetches it. The default
// option stays selectable and un-disabled no matter what this query is
// doing, so a slow or failed cluster call never blocks a submit.
export function PartitionPicker({ value, onValueChange }: PartitionPickerProps) {
  const cached = readCachedPartitions()

  const partitionsQuery = useQuery({
    queryKey: ['cluster-partitions'],
    queryFn: async () => {
      const partitions = await apiFetch<ClusterPartitions>('/cluster/partitions')
      writeCachedPartitions(partitions)
      return partitions
    },
    // Seeds this query from localStorage instead of a blank loading
    // state on every page load -- initialDataUpdatedAt is what tells
    // TanStack Query how old that seed is, so staleTime (the cache's
    // own TTL) decides whether it's still good enough or a background
    // refetch should fire right away.
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.cachedAtMs,
    staleTime: PARTITIONS_CACHE_TTL_MS,
  })

  const defaultPartitionName = partitionsQuery.data?.default_partition
  const options = partitionsQuery.data ? buildPartitionOptions(partitionsQuery.data) : []

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Partition</span>
        <button
          type="button"
          onClick={() => partitionsQuery.refetch()}
          disabled={partitionsQuery.isFetching}
          className="text-xs font-medium text-slate-400 hover:text-slate-200 disabled:opacity-50"
        >
          {partitionsQuery.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <select
        value={value ?? ''}
        onChange={(event) => onValueChange(event.target.value === '' ? null : event.target.value)}
        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
      >
        <option value="">{defaultPartitionName ? `Default (${defaultPartitionName})` : 'Default'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {partitionsQuery.isLoading && <p className="mt-1 text-xs text-slate-500">Loading partitions…</p>}
      {partitionsQuery.isError && (
        <p className="mt-1 text-xs text-red-400">
          Could not load partitions from the cluster: {String(partitionsQuery.error)}
          {partitionsQuery.data ? ' — showing a cached list.' : ' — only the default is available.'}
        </p>
      )}
    </div>
  )
}
