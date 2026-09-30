import { RotateCcw } from 'lucide-react'
import { Link } from 'react-router'
import type { RunListItem } from '../../api/client'
import { compareCandidateFromRun } from '../../utils/compareTray'
import { formatDuration } from '../../utils/formatDuration'
import { paths } from '../../utils/paths'
import { runningPhaseLabel } from '../../utils/runPhase'
import { isActiveRunStatus } from '../../utils/runStatus'
import { AddToCompareButton } from '../AddToCompareButton/AddToCompareButton'
import { BenchmarkName } from '../BenchmarkName/BenchmarkName'
import { BUTTON_ICON_SIZE, buttonClassName } from '../Button/Button.helper'
import { ModelName } from '../ModelName/ModelName'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { RunCancelButton } from '../RunCancelButton/RunCancelButton'
import { RunFailureReason } from '../RunFailureReason/RunFailureReason'
import { RunStatusChip } from '../RunStatusChip/RunStatusChip'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SetupChip } from '../SetupChip/SetupChip'
import { TableCell } from '../Table/Table'
import { Tooltip } from '../Tooltip/Tooltip'
import { truncationDisplay } from './RunsTableRow.helper'

interface RunsTableRowProps {
  run: RunListItem
  // Ticks every second while any run in view is active (owned by
  // RunsPage) -- a single shared clock, not one `setInterval` per row.
  now: Date
  showBatchColumn: boolean
  batchDisambiguator?: string | null
}

// Not exported -- only this row renders one, the same "small local
// subcomponent" pattern Sidebar.tsx uses for its own nav row.
function RunResultCell({ run }: { run: RunListItem }) {
  if (run.status === 'done') {
    const truncation = truncationDisplay(run.truncation_rate)
    return (
      <div className="space-y-0.5">
        <ScoreValue value={run.primary_metric_value} interval={run.primary_metric_confidence_interval} />
        {truncation && <p className={`text-xs ${truncation.toneClassName}`}>{truncation.text}</p>}
      </div>
    )
  }
  if (run.status === 'failed') {
    return <RunFailureReason run={run} />
  }
  return <span className="text-sm text-muted-foreground">—</span>
}

// One row, shared by the grouped and flat views: two lines per cell
// wherever there's identity plus context (Run's status plus live
// phase, Model & benchmark's name plus setup, Result's score plus
// truncation, Time's duration plus start), so the table reads at a
// glance without ten single-purpose columns.
export function RunsTableRow({ run, now, showBatchColumn, batchDisambiguator }: RunsTableRowProps) {
  const phaseLabel = runningPhaseLabel(run.status, run.endpoint_id)
  const active = isActiveRunStatus(run.status)

  return (
    <tr>
      <TableCell>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Link to={paths.run(run.id)} className="font-medium text-primary hover:underline">
              #{run.id}
            </Link>
            <RunStatusChip status={run.status} />
          </div>
          {phaseLabel && <p className="text-xs text-muted-foreground">{phaseLabel}</p>}
        </div>
      </TableCell>

      {showBatchColumn && (
        <TableCell>
          <Link to={paths.runs({ batch: run.run_group_id })} className="text-primary hover:underline">
            {run.run_group_name}
          </Link>
          {batchDisambiguator && <span className="ml-1 text-xs text-muted-foreground">{batchDisambiguator}</span>}
        </TableCell>
      )}

      <TableCell>
        <div className="space-y-0.5">
          <ModelName name={run.checkpoint_name} to={paths.model(run.checkpoint_id)} />
          <div className="flex items-center gap-1.5">
            <BenchmarkName benchmark={run.benchmark} standardLabel={run.standard_label} />
            <SetupChip samplingProfileLabel={run.sampling_profile_label} samplingProfileHash={run.sampling_profile_hash} />
          </div>
        </div>
      </TableCell>

      <TableCell>
        <RunResultCell run={run} />
      </TableCell>

      <TableCell>
        <div className="space-y-0.5">
          <p className="tabular-nums text-foreground">{formatDuration(run.created_at, run.finished_at, now)}</p>
          <p className="text-xs text-muted-foreground">
            {run.started_at ? <RelativeTime timestamp={run.started_at} /> : 'Not started'}
          </p>
        </div>
      </TableCell>

      <TableCell>{run.submitted_by ?? '—'}</TableCell>

      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <AddToCompareButton candidate={compareCandidateFromRun(run)} />
          {active ? (
            <RunCancelButton runId={run.id} />
          ) : (
            <Tooltip content="Re-run">
              <Link
                to={paths.newEvaluation({ from: run.id })}
                aria-label="Re-run"
                className={buttonClassName('ghost', BUTTON_ICON_SIZE.sm)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Tooltip>
          )}
        </div>
      </TableCell>
    </tr>
  )
}
