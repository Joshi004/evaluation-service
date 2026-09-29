// Non-DOM logic for CompareRunPicker.tsx: filtering by the search box
// and sorting newest-first -- recent runs are almost always what
// someone picking a comparison is looking for, the same idea the old
// two-run ComparePage.helper.ts's sortRunsForPicker applied.
import type { RunListItem } from '../../api/client'

export function filterRunsByQuery(runs: RunListItem[], query: string): RunListItem[] {
  const normalized = query.trim().toLowerCase()
  if (normalized === '') {
    return runs
  }
  return runs.filter(
    (run) => run.checkpoint_name.toLowerCase().includes(normalized) || String(run.id).includes(normalized),
  )
}

export function sortRunsByFinishedDesc(runs: RunListItem[]): RunListItem[] {
  return [...runs].sort((a, b) => new Date(b.finished_at ?? 0).getTime() - new Date(a.finished_at ?? 0).getTime())
}
