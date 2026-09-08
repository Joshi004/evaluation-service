import type { Checkpoint } from '../../data/types'

/** "Merge" with its two parents named, when this checkpoint came from the merge flow; otherwise the ordinary lineage op, or "Base" for a root. */
export function lineageSummary(checkpoint: Checkpoint, mergedFromCheckpoints: readonly Checkpoint[]): string {
  if (checkpoint.mergedFromIds) {
    const names = mergedFromCheckpoints.map((c) => c.name)
    return names.length > 0 ? `Merge of ${names.join(' + ')}` : 'Merge'
  }
  return checkpoint.lineageOp ?? 'Base'
}

export function stagingSummary(checkpoint: Checkpoint): string {
  return checkpoint.staged ? `Ready on ${checkpoint.storage.toUpperCase()}` : `Will sync from ${checkpoint.storage.toUpperCase()}`
}
