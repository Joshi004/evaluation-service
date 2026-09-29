// Non-DOM logic for RunReportHeader.tsx: the one piece of its meta line
// that depends on run state rather than a straight prop passthrough.
// Kept out of the component body per
// .cursor/rules/frontend-components.mdc.
import type { RunDetail } from '../../api/client'

// "finished 16 Sep" for a terminal run, "started 2 minutes ago" for one
// still queued or running -- a run with no finished_at yet has nothing
// to report finishing, so the meta line reads against started_at
// instead rather than showing an em dash.
export function timingLabel(run: RunDetail): { verb: string; timestamp: string | null } {
  return run.finished_at !== null
    ? { verb: 'finished', timestamp: run.finished_at }
    : { verb: 'started', timestamp: run.started_at }
}
