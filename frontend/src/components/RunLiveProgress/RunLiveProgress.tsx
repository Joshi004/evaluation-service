import type { RunDetail } from '../../api/client'
import { formatDuration } from '../../utils/formatDuration'
import { useNow } from '../../utils/useNow'
import { Card } from '../Card/Card'
import { CopyButton } from '../CopyButton/CopyButton'
import { KeyValueList } from '../KeyValueList/KeyValueList'
import { LogStream } from '../LogStream/LogStream'
import { PhaseProgress } from '../PhaseProgress/PhaseProgress'
import { RelativeTime } from '../RelativeTime/RelativeTime'

interface RunLiveProgressProps {
  run: RunDetail
}

const TICK_INTERVAL_MS = 1000

// The Overview tab's own content while a run is still queued or running
// (docs/UI_REDESIGN_PLAN.md §8.7, item 7's "state-aware default"): the
// three-step stepper, an elapsed time that keeps ticking between the
// run's own 5s poll, the model server's status once it has one, and its
// live harness log inline -- so watching a run finish never needs a
// second tab.
export function RunLiveProgress({ run }: RunLiveProgressProps) {
  const now = useNow(TICK_INTERVAL_MS)
  const endpoint = run.endpoint

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <PhaseProgress status={run.status} endpointId={run.endpoint_id} />
        <p className="text-sm text-muted-foreground">
          Elapsed {formatDuration(run.created_at, run.finished_at, now)}
        </p>
      </Card>

      {endpoint && (
        <Card>
          <h2 className="text-sm font-medium text-foreground">Model server</h2>
          <div className="mt-3">
            <KeyValueList
              rows={[
                {
                  label: 'URL',
                  value: endpoint.url ? (
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      {endpoint.url}
                      <CopyButton value={endpoint.url} label="Copy model server URL" />
                    </span>
                  ) : (
                    '\u2014'
                  ),
                },
                { label: 'SLURM job', value: endpoint.slurm_job_id ?? '\u2014' },
                { label: 'Partition', value: endpoint.partition ?? '\u2014' },
                { label: 'Expires', value: <RelativeTime timestamp={endpoint.expires_at} /> },
              ]}
            />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-medium text-foreground">Harness log</h2>
        <div className="mt-3">
          <LogStream key={`${run.id}-harness`} runId={run.id} source="harness" runIsFinished={false} />
        </div>
      </Card>
    </div>
  )
}
