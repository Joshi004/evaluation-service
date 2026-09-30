import { RotateCcw } from 'lucide-react'
import { Link } from 'react-router'
import type { RunDetail } from '../../api/client'
import { compareCandidateFromRun } from '../../utils/compareTray'
import { formatDuration } from '../../utils/formatDuration'
import { paths } from '../../utils/paths'
import { isActiveRunStatus } from '../../utils/runStatus'
import { AddToCompareButton } from '../AddToCompareButton/AddToCompareButton'
import { BenchmarkName } from '../BenchmarkName/BenchmarkName'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { CopyLinkButton } from '../CopyLinkButton/CopyLinkButton'
import { ModelName } from '../ModelName/ModelName'
import { PageHeader } from '../PageHeader/PageHeader'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { RunCancelButton } from '../RunCancelButton/RunCancelButton'
import { RunStatusChip } from '../RunStatusChip/RunStatusChip'
import { SetupChip } from '../SetupChip/SetupChip'
import { timingLabel } from './RunReportHeader.helper'

interface RunReportHeaderProps {
  run: RunDetail
}

// The run report's own header: identity (model, benchmark, setup,
// batch), state (status, timing, submitted by) and the actions every
// run needs regardless of which tab is open, so switching tabs never
// re-mounts or re-fetches any of this -- RunReportPage renders it
// once, above the <Outlet>.
export function RunReportHeader({ run }: RunReportHeaderProps) {
  const timing = timingLabel(run)
  const now = new Date()

  return (
    <PageHeader
      breadcrumb={
        <Link to={paths.runs()} className="hover:text-foreground hover:underline">
          Runs
        </Link>
      }
      title={`Run #${run.id}`}
      description={
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <ModelName name={run.checkpoint_name} to={paths.model(run.checkpoint_id)} copyable />
              <span className="text-muted-foreground">{'\u00b7'}</span>
              <BenchmarkName benchmark={run.benchmark} standardLabel={run.standard_label} />
              <SetupChip
                samplingProfileLabel={run.sampling_profile_label}
                samplingProfileHash={run.sampling_profile_hash}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <RunStatusChip status={run.status} />
              <span>{formatDuration(run.created_at, run.finished_at, now)}</span>
              {timing.timestamp !== null && (
                <span className="flex items-center gap-1">
                  {timing.verb}
                  <RelativeTime timestamp={timing.timestamp} />
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Batch{' '}
            <Link to={paths.runs({ batch: run.run_group_id })} className="text-primary hover:underline">
              {run.run_group_name}
            </Link>
            {' \u00b7 '}
            Submitted by {run.submitted_by ?? '\u2014'}
          </p>
        </div>
      }
      actions={
        <>
          <AddToCompareButton candidate={compareCandidateFromRun(run)} />
          <Link
            to={paths.newEvaluation({ from: run.id })}
            className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Re-run
          </Link>
          <CopyLinkButton />
          {isActiveRunStatus(run.status) && <RunCancelButton runId={run.id} />}
        </>
      }
    />
  )
}
