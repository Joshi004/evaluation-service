import type { ReactNode } from 'react'
import type { RunsStatusCounts, RunsStatusFilter as RunsStatusFilterValue } from '../../utils/runStatus'
import { SegmentedControl } from '../SegmentedControl/SegmentedControl'

interface RunStatusFilterProps {
  value: RunsStatusFilterValue
  counts: RunsStatusCounts
  onChange: (status: RunsStatusFilterValue) => void
  className?: string
}

// Only this control's own segments need a count alongside their label.
function statusOptionLabel(label: string, count: number): ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <span className="text-muted-foreground">{count}</span>
    </span>
  )
}

// The status SegmentedControl with counts, shared between RunsToolbar
// and the Model page's own Runs tab -- both need the identical
// five-way status control for a different run list.
export function RunStatusFilter({ value, counts, onChange, className }: RunStatusFilterProps) {
  return (
    <SegmentedControl
      className={className}
      aria-label="Status"
      value={value}
      onValueChange={(next) => onChange(next as RunsStatusFilterValue)}
      options={[
        { value: 'active', label: statusOptionLabel('Active', counts.active) },
        { value: 'done', label: statusOptionLabel('Done', counts.done) },
        { value: 'failed', label: statusOptionLabel('Failed', counts.failed) },
        { value: 'cancelled', label: statusOptionLabel('Cancelled', counts.cancelled) },
        { value: 'all', label: statusOptionLabel('All', counts.all) },
      ]}
    />
  )
}
