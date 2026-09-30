// Non-DOM logic for ClusterPartitionsCard.tsx: turning a
// ClusterPartitions response into table rows, sorted default-first
// then alphabetically (docs/UI_REDESIGN_PLAN.md §8.13's own layout
// sketch shows the default partition on top).
import type { ClusterPartitions } from '../../api/client'
import type { BadgeTone } from '../Badge/Badge.helper'

export interface PartitionRow {
  name: string
  isDefault: boolean
  // "Up" rather than the raw "UP" SLURM reports -- every other state
  // (draining, down, ...) is title-cased the same way, so the column
  // never mixes shouting-case and normal words.
  stateLabel: string
  stateTone: BadgeTone
  priorityTier: number
  hidden: boolean
}

function titleCase(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function buildPartitionRows(clusterPartitions: ClusterPartitions): PartitionRow[] {
  const sorted = [...clusterPartitions.partitions].sort((a, b) => {
    const aIsDefault = a.name === clusterPartitions.default_partition
    const bIsDefault = b.name === clusterPartitions.default_partition
    if (aIsDefault !== bIsDefault) {
      return aIsDefault ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  return sorted.map((partition) => ({
    name: partition.name,
    isDefault: partition.name === clusterPartitions.default_partition,
    stateLabel: titleCase(partition.state),
    stateTone: partition.state === 'UP' ? 'success' : 'warning',
    priorityTier: partition.priority_tier,
    hidden: partition.hidden,
  }))
}
