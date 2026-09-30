// Resolves one checkpoint's parent and children against the full
// checkpoint list (Phase 11, docs/UI_REDESIGN_PLAN.md section 8.11's
// Lineage tab). GET /checkpoints/{id} already returns parent_checkpoint_id
// as a raw id -- this turns that id (and the reverse child relationship,
// which no endpoint returns directly) into the actual CheckpointListItem
// rows a page can render a name and status badge for.
import type { CheckpointListItem } from '../api/client'

export interface ModelLineage {
  parent: CheckpointListItem | null
  // True when parent_checkpoint_id names a checkpoint GET /checkpoints
  // no longer returns (deleted after being set as a parent) -- shown
  // as "Parent model no longer exists" rather than silently rendering
  // as if this checkpoint had no parent at all.
  parentMissing: boolean
  children: CheckpointListItem[]
}

export function resolveModelLineage(
  checkpoint: CheckpointListItem,
  allCheckpoints: CheckpointListItem[],
): ModelLineage {
  const children = allCheckpoints
    .filter((candidate) => candidate.parent_checkpoint_id === checkpoint.id)
    .sort((a, b) => a.name.localeCompare(b.name))

  if (checkpoint.parent_checkpoint_id === null) {
    return { parent: null, parentMissing: false, children }
  }

  const parent = allCheckpoints.find((candidate) => candidate.id === checkpoint.parent_checkpoint_id) ?? null
  return { parent, parentMissing: parent === null, children }
}
