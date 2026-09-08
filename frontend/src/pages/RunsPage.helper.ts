// Non-DOM logic for RunsPage.tsx: grouping the flat /runs response by
// run_group_id (every run belongs to a group, even a submit of one --
// see app/models/run_group.py) and deciding which runs a cancel button
// applies to. Formatting shared with RunDetailPage (elapsed time,
// fraction-as-percent, recipe label-or-hash) lives in src/utils/ instead.

import type { RunListItem } from '../api/client'

export interface RunGroupSection {
  runGroupId: number
  runGroupName: string
  runs: RunListItem[]
}

const TERMINAL_STATUSES = new Set(['done', 'failed', 'cancelled'])

export function isCancellable(status: string): boolean {
  return !TERMINAL_STATUSES.has(status)
}

// GET /runs already orders by created_at desc, and Map preserves the
// insertion order of each key's first appearance -- so the group
// containing the most recently created run (whoever just submitted)
// ends up first here too, with no separate sort needed.
export function groupRunsByGroup(runs: RunListItem[]): RunGroupSection[] {
  const sections = new Map<number, RunGroupSection>()
  for (const run of runs) {
    let section = sections.get(run.run_group_id)
    if (!section) {
      section = { runGroupId: run.run_group_id, runGroupName: run.run_group_name, runs: [] }
      sections.set(run.run_group_id, section)
    }
    section.runs.push(run)
  }
  return [...sections.values()]
}
