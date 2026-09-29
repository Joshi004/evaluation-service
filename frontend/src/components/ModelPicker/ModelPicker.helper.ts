// Non-DOM logic for ModelPicker.tsx: searching and family-grouping the
// Choose step's model list. Mirrors buildLeaderboard.ts's own
// buildFamilyOptions -- first spelling seen becomes the group's label,
// since stored family strings are inconsistent in real data ("QWen3.5"
// vs "Qwen-3.5") and familyKey is what makes the two collapse into one
// group despite that.
import type { CheckpointListItem } from '../../api/client'
import { familyKey } from '../../utils/familyKey'
import { NO_FAMILY_KEY } from '../../utils/buildLeaderboard'

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

export interface CheckpointFamilyGroup {
  key: string
  label: string
  checkpoints: CheckpointListItem[]
}

// "No family" sorts last, every real family alphabetically before it --
// mirrors buildFamilyOptions' own ordering, so the two lists a person
// might see side by side (this picker, and a future Models page filter)
// never disagree about where an unfamilied checkpoint sits.
export function groupCheckpointsByFamily(checkpoints: CheckpointListItem[]): CheckpointFamilyGroup[] {
  const groupsByKey = new Map<string, CheckpointFamilyGroup>()
  const noFamily: CheckpointListItem[] = []

  for (const checkpoint of checkpoints) {
    if (checkpoint.family === null) {
      noFamily.push(checkpoint)
      continue
    }
    const key = familyKey(checkpoint.family)
    const group = groupsByKey.get(key)
    if (group) {
      group.checkpoints.push(checkpoint)
    } else {
      groupsByKey.set(key, { key, label: checkpoint.family, checkpoints: [checkpoint] })
    }
  }

  const groups = [...groupsByKey.values()].sort((a, b) => a.label.localeCompare(b.label))
  for (const group of groups) {
    group.checkpoints.sort((a, b) => a.name.localeCompare(b.name))
  }
  if (noFamily.length > 0) {
    groups.push({
      key: NO_FAMILY_KEY,
      label: 'No family',
      checkpoints: noFamily.sort((a, b) => a.name.localeCompare(b.name)),
    })
  }
  return groups
}
