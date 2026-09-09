// Non-DOM logic for CheckpointDetailPage.tsx: grouping checkpoints by
// family, resolving a parent's display name, flipping one row's
// expanded state, and formatting a stale availability check as
// relative time.
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

// Locale left undefined (browser default) rather than hardcoded, same
// choice RunDetailPage.helper.ts's formatTimestamp makes for
// toLocaleString().
const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// `availability_checked_at` as "3 hours ago" rather than a raw
// timestamp -- how stale a check is matters more than its exact
// wall-clock time. Callers only reach for this once
// availability_checked_at is known non-null: a never-checked row is
// its own state (R-T28), rendered from availability_status alone, not
// from this function.
export function formatRelativeTime(timestamp: string): string {
  const elapsedMs = Date.now() - new Date(timestamp).getTime()

  if (elapsedMs < MINUTE_MS) {
    return 'just now'
  }
  if (elapsedMs < HOUR_MS) {
    return RELATIVE_TIME_FORMATTER.format(-Math.round(elapsedMs / MINUTE_MS), 'minute')
  }
  if (elapsedMs < DAY_MS) {
    return RELATIVE_TIME_FORMATTER.format(-Math.round(elapsedMs / HOUR_MS), 'hour')
  }
  return RELATIVE_TIME_FORMATTER.format(-Math.round(elapsedMs / DAY_MS), 'day')
}
