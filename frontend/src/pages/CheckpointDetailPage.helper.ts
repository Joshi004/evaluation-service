// Non-DOM logic for CheckpointDetailPage.tsx: grouping checkpoints by
// family, resolving a parent's display name, and flipping one row's
// expanded state. Relative-time formatting moved to
// utils/formatRelativeTime.ts once RelativeTime (Phase 4) became a
// second user.
import type { CheckpointListItem } from '../api/client'

// `family` is nullish for a checkpoint nobody's grouped yet -- bucket it
// under "Ungrouped" rather than dropping it from the page.
export function groupByFamily(checkpoints: CheckpointListItem[]): Map<string, CheckpointListItem[]> {
  const groups = new Map<string, CheckpointListItem[]>()
  for (const checkpoint of checkpoints) {
    const family = checkpoint.family ?? 'Ungrouped'
    const group = groups.get(family)
    if (group) {
      group.push(checkpoint)
    } else {
      groups.set(family, [checkpoint])
    }
  }
  return groups
}

export function parentName(checkpoint: CheckpointListItem, allCheckpoints: CheckpointListItem[]): string {
  if (checkpoint.parent_checkpoint_id === null) {
    return '—'
  }
  const parent = allCheckpoints.find((candidate) => candidate.id === checkpoint.parent_checkpoint_id)
  return parent?.name ?? `#${checkpoint.parent_checkpoint_id}`
}

// The checkpoints page's row-expansion state, kept as an id array (the
// same toggle-membership idiom as SubmitGrid.helper.ts's toggleId) so
// more than one inferred-metadata panel can be open at once.
export function toggleExpandedId(expandedIds: number[], checkpointId: number): number[] {
  return expandedIds.includes(checkpointId)
    ? expandedIds.filter((id) => id !== checkpointId)
    : [...expandedIds, checkpointId]
}
