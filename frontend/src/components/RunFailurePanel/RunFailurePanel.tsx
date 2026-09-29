import { useState } from 'react'
import { Link } from 'react-router'
import type { RunDetail } from '../../api/client'
import { classifyRunError } from '../../utils/classifyRunError'
import { formatDuration } from '../../utils/formatDuration'
import { paths } from '../../utils/paths'
import { Badge } from '../Badge/Badge'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { Card } from '../Card/Card'
import { CopyButton } from '../CopyButton/CopyButton'
import { LogStream } from '../LogStream/LogStream'

interface RunFailurePanelProps {
  run: RunDetail
}

const FAILURE_LOG_TAIL_LINES = 20

// The Overview tab's own content for a failed or cancelled run
// (docs/UI_REDESIGN_PLAN.md §8.7, item 7's "state-aware default":
// "failed/cancelled -> 'what went wrong' panel first"). A failed run
// gets classifyRunError's plain-language reason with the raw error
// tucked behind a disclosure; a cancelled run has no `error` string at
// all (worker.cancel_run writes the status directly, with nothing to
// classify) and gets its own short explanation instead.
export function RunFailurePanel({ run }: RunFailurePanelProps) {
  const now = new Date()
  const classification = run.status === 'failed' ? classifyRunError(run.error) : null
  const [showRaw, setShowRaw] = useState(false)

  return (
    <Card className="space-y-4">
      <div>
        <Badge tone={run.status === 'failed' ? 'danger' : 'warning'}>
          {run.status === 'failed' ? 'Failed' : 'Cancelled'}
        </Badge>
        <p className="mt-2 text-lg font-medium text-foreground">
          {run.status === 'failed'
            ? (classification?.title ?? 'The run failed')
            : `This run was cancelled after ${formatDuration(run.created_at, run.finished_at, now)}`}
        </p>
        {classification?.hint && <p className="mt-1 text-sm text-muted-foreground">{classification.hint}</p>}
      </div>

      {classification && (
        <div>
          <button
            type="button"
            onClick={() => setShowRaw((current) => !current)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showRaw ? 'Hide raw error' : 'Show raw error'}
          </button>
          {showRaw && (
            <div className="mt-2 flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap text-muted-foreground">
                {classification.raw}
              </pre>
              <CopyButton value={classification.raw} label="Copy raw error" />
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-foreground">Last log lines</h2>
        <div className="mt-2">
          <LogStream
            key={`${run.id}-harness-tail`}
            runId={run.id}
            source="harness"
            runIsFinished
            maxLines={FAILURE_LOG_TAIL_LINES}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link to={paths.runLogs(run.id)} className="text-sm font-medium text-primary hover:underline">
          Open logs →
        </Link>
        <Link
          to={paths.newEvaluation({ from: run.id })}
          className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}
        >
          Re-run
        </Link>
      </div>
    </Card>
  )
}
