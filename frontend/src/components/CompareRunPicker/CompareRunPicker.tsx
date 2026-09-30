import { useState } from 'react'
import type { RunListItem } from '../../api/client'
import { cn } from '../../utils/cn'
import { Badge } from '../Badge/Badge'
import { Checkbox } from '../Checkbox/Checkbox'
import { EmptyState } from '../EmptyState/EmptyState'
import { ModelName } from '../ModelName/ModelName'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SearchInput } from '../SearchInput/SearchInput'
import { SetupChip } from '../SetupChip/SetupChip'
import { filterRunsByQuery, sortRunsByFinishedDesc } from './CompareRunPicker.helper'

interface CompareRunPickerProps {
  runs: RunListItem[]
  selectedRunIds: number[]
  maxSelectable: number
  // The start state's own "first pick = baseline" rule (§8.8 item 8)
  // -- false in the Add run dialog, where none of these picks becomes
  // the baseline (that's already fixed before this dialog opens).
  labelFirstSelectedAsBaseline: boolean
  onToggle: (runId: number) => void
}

// Shared list body for both the compare page's own start state (a
// fresh 2-4 selection) and its Add run dialog (adding to an existing
// comparison) -- docs/UI_REDESIGN_PLAN.md §8.8. `runs` arrives already
// filtered to the right benchmark (and, for Add run, with runs already
// in the comparison excluded); this component only searches, sorts
// and reports toggles.
export function CompareRunPicker({
  runs,
  selectedRunIds,
  maxSelectable,
  labelFirstSelectedAsBaseline,
  onToggle,
}: CompareRunPickerProps) {
  const [query, setQuery] = useState('')

  if (runs.length === 0) {
    return <EmptyState title="No finished runs" description="Finished runs will show up here once any exist." />
  }

  const visibleRuns = sortRunsByFinishedDesc(filterRunsByQuery(runs, query))
  const atLimit = selectedRunIds.length >= maxSelectable

  return (
    <div className="space-y-2">
      <SearchInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery('')}
        placeholder="Search by model or run number"
      />
      <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {visibleRuns.map((run) => {
          const selected = selectedRunIds.includes(run.id)
          const isBaseline = labelFirstSelectedAsBaseline && selectedRunIds[0] === run.id
          return (
            <li key={run.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
                  selected && 'bg-primary-soft',
                  !selected && atLimit && 'cursor-not-allowed opacity-50',
                )}
              >
                <Checkbox checked={selected} disabled={!selected && atLimit} onChange={() => onToggle(run.id)} />
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">#{run.id}</span>
                <ModelName name={run.checkpoint_name} className="min-w-0 flex-1" />
                {isBaseline && <Badge tone="info">Baseline</Badge>}
                <SetupChip
                  samplingProfileLabel={run.sampling_profile_label}
                  samplingProfileHash={run.sampling_profile_hash}
                />
                <ScoreValue
                  value={run.primary_metric_value}
                  interval={run.primary_metric_confidence_interval}
                  className="w-20 shrink-0 text-right"
                />
                <RelativeTime timestamp={run.finished_at} className="w-20 shrink-0 text-right text-xs" />
              </label>
            </li>
          )
        })}
      </ul>
      {visibleRuns.length === 0 && <p className="px-1 text-sm text-muted-foreground">No runs match "{query}".</p>}
    </div>
  )
}
