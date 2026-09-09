// Non-DOM logic for CandidateBrowser.tsx: filtering the candidate list
// by the free-text filter box. Matches against both display_name and
// reference, since a user hunting for a specific checkpoint may
// remember either the directory's name or a fragment of its path.
import type { CheckpointCandidate } from '../../api/client'

export function filterCandidates(
  candidates: CheckpointCandidate[],
  filterText: string,
): CheckpointCandidate[] {
  const normalizedFilter = filterText.trim().toLowerCase()
  if (normalizedFilter === '') {
    return candidates
  }
  return candidates.filter(
    (candidate) =>
      candidate.display_name.toLowerCase().includes(normalizedFilter) ||
      candidate.reference.toLowerCase().includes(normalizedFilter),
  )
}
