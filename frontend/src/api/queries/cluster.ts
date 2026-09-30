import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type ClusterPartitions, type SlurmPartition } from '../client'
import { queryKeys } from './queryKeys'

const STORAGE_KEY = 'evalsvc.cluster-partitions-cache.v1'

// A week: long enough that most sessions never re-fetch, short enough
// that a real cluster change (a partition renamed, added, or drained)
// surfaces within a normal work cycle even if nobody clicks Refresh.
export const PARTITIONS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface CachedPartitions {
  data: ClusterPartitions
  cachedAtMs: number
}

// Parsed JSON from localStorage is `unknown`, not `ClusterPartitions` --
// this is what turns "trust the cache" into "verify the cache", so a
// stale shape from an older version of this app (or a hand-edited
// value) falls back to a cache miss instead of a runtime crash deeper
// in the component.
function isSlurmPartition(value: unknown): value is SlurmPartition {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.name === 'string' &&
    typeof record.state === 'string' &&
    typeof record.hidden === 'boolean' &&
    typeof record.priority_tier === 'number'
  )
}

function isClusterPartitions(value: unknown): value is ClusterPartitions {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.default_partition === 'string' &&
    Array.isArray(record.partitions) &&
    record.partitions.every(isSlurmPartition)
  )
}

function isCachedPartitions(value: unknown): value is CachedPartitions {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return typeof record.cachedAtMs === 'number' && isClusterPartitions(record.data)
}

// Both functions swallow storage errors (disabled storage, a full
// quota, corrupted JSON) rather than throwing -- a cache miss is always
// a safe fallback here, since the picker's query just refetches from
// the backend on the next manual Refresh.
function readCachedPartitions(): CachedPartitions | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    return isCachedPartitions(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeCachedPartitions(data: ClusterPartitions): void {
  try {
    const cached: CachedPartitions = { data, cachedAtMs: Date.now() }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))
  } catch {
    // Losing the cache costs a refetch next time, not correctness.
  }
}

// The Submit page's partition picker (per-run SLURM partition
// selection) reads the cluster's real partition list -- including a
// hidden, lower-priority one like `background` that never appears in
// SLURM's own unqualified listing commands. `enabled: false` (ground
// rule 15: never poll an SSH-backed read) -- PartitionPicker calls
// `refetch()` from its own Refresh button; this hook seeds itself from
// localStorage so a normal session still shows last week's list without
// ever calling the cluster on mount.
export function useClusterPartitions(): UseQueryResult<ClusterPartitions> {
  const cached = readCachedPartitions()

  return useQuery({
    queryKey: queryKeys.clusterPartitions(),
    queryFn: async () => {
      const partitions = await apiFetch<ClusterPartitions>('/cluster/partitions')
      writeCachedPartitions(partitions)
      return partitions
    },
    enabled: false,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.cachedAtMs,
    staleTime: PARTITIONS_CACHE_TTL_MS,
    // The default 3 retries would turn one Refresh click into four
    // SSH calls against the cluster -- the same ground rule 15 this
    // hook's own `enabled: false` already honours. The Refresh button
    // itself is what a human retries with.
    retry: false,
  })
}
