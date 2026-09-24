// Non-DOM logic for PartitionPicker.tsx: the localStorage cache (the
// partition list changes on the order of once a month, per the design
// discussion, so a week-long cache plus a manual Refresh button covers
// both the common case and the rare change) and turning a
// ClusterPartitions response into a flat list of <option> data.
import type { ClusterPartitions, SlurmPartition } from '../../api/client'

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
// a safe fallback here, since the picker's useQuery just refetches from
// the backend.
export function readCachedPartitions(): CachedPartitions | null {
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

export function writeCachedPartitions(data: ClusterPartitions): void {
  try {
    const cached: CachedPartitions = { data, cachedAtMs: Date.now() }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))
  } catch {
    // Losing the cache costs a refetch next time, not correctness.
  }
}

export interface PartitionOption {
  value: string
  label: string
  disabled: boolean
}

// One line per real SLURM fact worth surfacing: hidden (the whole
// reason this listing exists -- `background` never appears in SLURM's
// own unqualified sinfo/squeue), and priority tier (a hidden partition
// is typically a *lower*-priority one, which is worth knowing before
// picking it for something time-sensitive). A partition not in state
// `UP` (draining, down) is listed but disabled -- sbatch would reject
// it anyway, and a disabled option still explains why it's there rather
// than silently vanishing between one Refresh and the next.
function describePartition(partition: SlurmPartition): string {
  const parts = [partition.name]
  if (partition.hidden) {
    parts.push('hidden')
  }
  parts.push(`priority ${partition.priority_tier}`)
  if (partition.state !== 'UP') {
    parts.push(partition.state.toLowerCase())
  }
  return parts.join(' · ')
}

export function buildPartitionOptions(clusterPartitions: ClusterPartitions): PartitionOption[] {
  return clusterPartitions.partitions
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((partition) => ({
      value: partition.name,
      label: describePartition(partition),
      disabled: partition.state !== 'UP',
    }))
}
