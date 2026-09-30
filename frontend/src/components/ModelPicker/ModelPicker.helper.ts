// Non-DOM logic for ModelPicker.tsx: searching the Choose step's model
// list. Family-grouping itself lives in utils/familyGroups.ts -- shared
// with the Models page, the Leaderboard's own family filter and the
// registration wizard's family input, so all four can never disagree
// about a family's label.
import type { CheckpointListItem } from '../../api/client'

export function filterCheckpointsByQuery(checkpoints: CheckpointListItem[], query: string): CheckpointListItem[] {
  const trimmed = query.trim().toLowerCase()
  if (trimmed === '') {
    return checkpoints
  }
  return checkpoints.filter(
    (checkpoint) =>
      checkpoint.name.toLowerCase().includes(trimmed) ||
      (checkpoint.family?.toLowerCase().includes(trimmed) ?? false),
  )
}
