// Groups standards by category, then display name -- the same
// ordering rule buildLeaderboard.ts's own compareColumns uses for the
// Leaderboard's column order, kept as its own small function here
// rather than reused directly since it sorts BenchmarkColumn (a
// pivoted leaderboard row), not StandardSummary (the catalog row this
// file's own callers read). Promoted from BenchmarkPicker.helper.ts
// (Phase 12, docs/UI_REDESIGN_PLAN.md §8.12) once the Benchmarks list
// page became a second caller that needs the same grouping over the
// same catalog rows.
import type { StandardSummary } from '../api/client'

export interface StandardCategoryGroup {
  category: string | null
  standards: StandardSummary[]
}

function compareStandardsByCategoryThenName(a: StandardSummary, b: StandardSummary): number {
  if (a.category === null && b.category !== null) return 1
  if (a.category !== null && b.category === null) return -1
  if (a.category !== b.category) {
    return (a.category ?? '').localeCompare(b.category ?? '')
  }
  return (a.display_name ?? a.benchmark).localeCompare(b.display_name ?? b.benchmark)
}

export function groupStandardsByCategory(standards: StandardSummary[]): StandardCategoryGroup[] {
  const sorted = [...standards].sort(compareStandardsByCategoryThenName)
  const groups: StandardCategoryGroup[] = []
  for (const standard of sorted) {
    const currentGroup = groups[groups.length - 1]
    if (currentGroup && currentGroup.category === standard.category) {
      currentGroup.standards.push(standard)
    } else {
      groups.push({ category: standard.category, standards: [standard] })
    }
  }
  return groups
}
