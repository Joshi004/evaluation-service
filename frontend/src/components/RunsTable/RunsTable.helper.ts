// Non-DOM logic for RunsTable.tsx (docs/UI_REDESIGN_PLAN.md §8.9): the
// grouped view's own batch sections -- built from *all* loaded runs, so
// a batch header summarises the whole batch even when a filter hides
// some of its rows ("Batch headers summarise the whole batch ...
// because Cancel batch acts on the whole batch") -- plus the
// duplicate-batch-name suffix and the small status-breakdown caption
// the header shows next to BatchProgressBar.

import type { RunListItem } from '../../api/client'
import { compareRunsNewestFirst } from '../../pages/RunsPage.helper'
import { isActiveRunStatus } from '../../utils/runStatus'

export interface BatchSummary {
  runGroupId: number
  runGroupName: string
  // Set only when another *visible* batch shares this exact name (the
  // two real "if-eval-02" batches, run_group_id 4 and 6) -- disambiguating
  // a name no other visible section shares would be noise, and a batch
  // hidden entirely by the current filters isn't a collision worth
  // announcing.
  disambiguator: string | null
  // Every run in this batch, regardless of the current filters -- the
  // progress bar and the Cancel batch count both read this, not
  // `visibleRunCount` below.
  allRunsInBatch: RunListItem[]
  visibleRunCount: number
  cancellableCount: number
  // The batch's own run_group row has its own created_at
  // (app/models/run_group.py), but RunListItem doesn't carry it -- the
  // earliest of its own runs' created_at reads as "when this batch was
  // submitted" instead, with no backend change needed.
  createdAt: string
}

export interface RunsSection {
  batch: BatchSummary
  visibleRuns: RunListItem[]
}

function batchDisambiguator(runGroupId: number): string {
  return `batch ${runGroupId}`
}

function groupRunsByRunGroupId(runs: RunListItem[]): Map<number, RunListItem[]> {
  const runsByGroupId = new Map<number, RunListItem[]>()
  for (const run of runs) {
    const runsInGroup = runsByGroupId.get(run.run_group_id)
    if (runsInGroup) {
      runsInGroup.push(run)
    } else {
      runsByGroupId.set(run.run_group_id, [run])
    }
  }
  return runsByGroupId
}

// One BatchSummary per run_group_id present in `visibleRuns`, built
// from `allRuns` so its own counts and progress bar reflect the whole
// batch -- a batch with e.g. 4 runs where a status filter hides 2 still
// reports "4 runs" and shows all 4 in its progress bar, with "2 shown"
// noting what the table itself displays underneath.
function buildBatchSummaries(visibleRuns: RunListItem[], allRuns: RunListItem[]): BatchSummary[] {
  const visibleRunGroupIds = new Set(visibleRuns.map((run) => run.run_group_id))
  const allRunsByGroupId = groupRunsByRunGroupId(allRuns.filter((run) => visibleRunGroupIds.has(run.run_group_id)))
  const visibleRunsByGroupId = groupRunsByRunGroupId(visibleRuns)

  const nameOccurrences = new Map<string, number>()
  for (const runsInGroup of allRunsByGroupId.values()) {
    const name = runsInGroup[0].run_group_name
    nameOccurrences.set(name, (nameOccurrences.get(name) ?? 0) + 1)
  }

  return [...allRunsByGroupId.entries()].map(([runGroupId, allRunsInBatch]) => {
    const runGroupName = allRunsInBatch[0].run_group_name
    const earliestCreatedAt = allRunsInBatch.reduce(
      (earliest, run) => (run.created_at < earliest ? run.created_at : earliest),
      allRunsInBatch[0].created_at,
    )
    return {
      runGroupId,
      runGroupName,
      disambiguator: (nameOccurrences.get(runGroupName) ?? 0) > 1 ? batchDisambiguator(runGroupId) : null,
      allRunsInBatch,
      visibleRunCount: visibleRunsByGroupId.get(runGroupId)?.length ?? 0,
      cancellableCount: allRunsInBatch.filter((run) => isActiveRunStatus(run.status)).length,
      createdAt: earliestCreatedAt,
    }
  })
}

// Newest batch first, by its own earliest run -- matches the flat
// list's own newest-first rule (RunsPage.helper.ts's
// compareRunsNewestFirst) so switching between By batch and Flat list
// never reorders what's on screen.
function compareBatchesNewestFirst(a: BatchSummary, b: BatchSummary): number {
  const createdDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  return createdDiff !== 0 ? createdDiff : b.runGroupId - a.runGroupId
}

export function buildRunsSections(visibleRuns: RunListItem[], allRuns: RunListItem[]): RunsSection[] {
  const batches = buildBatchSummaries(visibleRuns, allRuns).sort(compareBatchesNewestFirst)
  const visibleRunsByGroupId = groupRunsByRunGroupId(visibleRuns)

  return batches.map((batch) => ({
    batch,
    visibleRuns: [...(visibleRunsByGroupId.get(batch.runGroupId) ?? [])].sort(compareRunsNewestFirst),
  }))
}

// Fixed order so two batch headers always read the same way, and only
// statuses actually present are listed -- "1 done · 2 failed ·
// 1 cancelled" (§8.9's own sketch), never "0 queued · 0 running · ...".
const STATUS_BREAKDOWN_ORDER = ['done', 'failed', 'cancelled', 'running', 'queued'] as const
const STATUS_BREAKDOWN_LABELS: Record<(typeof STATUS_BREAKDOWN_ORDER)[number], string> = {
  done: 'done',
  failed: 'failed',
  cancelled: 'cancelled',
  running: 'running',
  queued: 'queued',
}

export function describeBatchStatusBreakdown(runs: RunListItem[]): string {
  return STATUS_BREAKDOWN_ORDER.map((status) => {
    const count = runs.filter((run) => run.status === status).length
    return count > 0 ? `${count} ${STATUS_BREAKDOWN_LABELS[status]}` : null
  })
    .filter((part): part is string => part !== null)
    .join(' \u00b7 ')
}
