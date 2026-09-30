// Non-DOM logic for BatchProgressBar.tsx: turning a batch's own runs
// into stacked-bar segments and the "N of M runs finished" caption that
// carries the meaning colour alone can't. Segment colours reuse
// RunStatusChip's own tone map and
// SystemStatus.helper.ts's solid-fill variant of it (Badge's own
// TONE_CLASSES is a soft-background pill, the wrong shape for a bar
// segment) -- one tone-to-colour mapping, not a second one invented
// here.
import type { RunListItem } from '../../api/client'
import { runStatusStyle } from '../RunStatusChip/RunStatusChip.helper'
import { SYSTEM_STATUS_DOT_CLASSES } from '../SystemStatus/SystemStatus.helper'

// The CheckConstraint in app/models/eval_run.py -- every status a run
// can ever hold, in the order the bar draws its segments left to right.
const RUN_STATUSES_IN_DRAW_ORDER = ['queued', 'running', 'done', 'failed', 'cancelled'] as const

export interface BatchProgressSegment {
  status: string
  count: number
  toneClassName: string
}

export function buildBatchProgressSegments(runs: Pick<RunListItem, 'status'>[]): BatchProgressSegment[] {
  return RUN_STATUSES_IN_DRAW_ORDER.map((status) => ({
    status,
    count: runs.filter((run) => run.status === status).length,
    toneClassName: SYSTEM_STATUS_DOT_CLASSES[runStatusStyle(status).tone],
  })).filter((segment) => segment.count > 0)
}

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['done', 'failed', 'cancelled'])

export function countFinishedRuns(runs: Pick<RunListItem, 'status'>[]): number {
  return runs.filter((run) => TERMINAL_STATUSES.has(run.status)).length
}

export function batchProgressSummary(runs: Pick<RunListItem, 'status'>[]): string {
  const finished = countFinishedRuns(runs)
  const total = runs.length
  return `${finished} of ${total} run${total === 1 ? '' : 's'} finished`
}
