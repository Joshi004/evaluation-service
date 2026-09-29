// Non-DOM logic for PartitionPicker.tsx: turning a ClusterPartitions
// response into a flat list of <option> data. The query itself, and
// the localStorage cache behind it, live in
// src/api/queries/cluster.ts's useClusterPartitions (Phase 4) -- this
// file keeps only the part that's specific to rendering the picker.
import type { ClusterPartitions, SlurmPartition } from '../../api/client'

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
