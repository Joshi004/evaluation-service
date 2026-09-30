import { useState } from 'react'
import { Card } from '../components/Card/Card'
import { Checkbox } from '../components/Checkbox/Checkbox'
import { LogStream } from '../components/LogStream/LogStream'
import type { LogSource } from '../components/LogStream/LogStream.helper'
import { SegmentedControl } from '../components/SegmentedControl/SegmentedControl'
import { isActiveRunStatus } from '../utils/runStatus'
import { useRunReport } from './RunReportPage.helper'

const LOG_SOURCE_OPTIONS: { value: LogSource; label: string }[] = [
  { value: 'harness', label: 'Harness' },
  // `endpoint` -> "Model server" in user-facing copy.
  { value: 'endpoint', label: 'Model server' },
]

// The Logs tab: LogStream restyled, with a source toggle and
// Follow/Wrap controls on top.
export function RunLogsTab() {
  const { run } = useRunReport()
  const [source, setSource] = useState<LogSource>('harness')
  const [follow, setFollow] = useState(true)
  const [wrap, setWrap] = useState(true)

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={LOG_SOURCE_OPTIONS}
          value={source}
          onValueChange={(value) => setSource(value as LogSource)}
          aria-label="Log source"
        />
        <div className="flex items-center gap-4 text-sm text-foreground">
          <label className="flex items-center gap-2">
            <Checkbox checked={follow} onChange={(event) => setFollow(event.target.checked)} />
            Follow
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={wrap} onChange={(event) => setWrap(event.target.checked)} />
            Wrap lines
          </label>
        </div>
      </div>

      {/* Keyed on run id and source -- LogStream's own docstring calls
          this out as exactly the case that needs both in the key, since
          this tab doesn't unmount on its own when only one of them
          changes. */}
      <LogStream
        key={`${run.id}-${source}`}
        runId={run.id}
        source={source}
        runIsFinished={!isActiveRunStatus(run.status)}
        follow={follow}
        wrap={wrap}
      />
    </Card>
  )
}
