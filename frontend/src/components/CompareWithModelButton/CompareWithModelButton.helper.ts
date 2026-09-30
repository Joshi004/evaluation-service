import type { CheckpointListItem } from '../../api/client'

// Parent first (if it is among the candidates), then every other model
// alphabetically -- docs/UI_REDESIGN_PLAN.md §8.11's own decision: "It
// lists other models (parent first)".
export function orderCandidatesParentFirst(
  candidates: CheckpointListItem[],
  parentCheckpointId: number | null,
): CheckpointListItem[] {
  const parent = candidates.find((candidate) => candidate.id === parentCheckpointId) ?? null
  const rest = candidates
    .filter((candidate) => candidate.id !== parentCheckpointId)
    .sort((a, b) => a.name.localeCompare(b.name))
  return parent ? [parent, ...rest] : rest
}
