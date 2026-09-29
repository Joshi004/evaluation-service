import type { UseQueryResult } from '@tanstack/react-query'
import { AlertTriangle, CircleCheck } from 'lucide-react'
import type { RunDetail, RunDiagnostics } from '../../api/client'
import { Badge } from '../Badge/Badge'
import { Skeleton } from '../Skeleton/Skeleton'
import { Tooltip } from '../Tooltip/Tooltip'
import {
  emptyAnswersChip,
  erroredRequestsChip,
  latencySpreadChip,
  truncatedChip,
  type HealthChip,
} from './RunHealthChips.helper'

interface RunHealthChipsProps {
  run: RunDetail
  diagnostics: UseQueryResult<RunDiagnostics>
}

function Chip({ chip }: { chip: HealthChip }) {
  const Icon = chip.tone === 'success' ? CircleCheck : AlertTriangle
  return (
    <Tooltip content={chip.tooltip}>
      <span tabIndex={0}>
        <Badge tone={chip.tone} className="gap-1">
          <Icon className="h-3 w-3" aria-hidden="true" />
          {chip.text}
        </Badge>
      </span>
    </Tooltip>
  )
}

// Four at-a-glance health signals (docs/UI_REDESIGN_PLAN.md §8.7, item
// 2) -- never colour alone (§4.5): each chip carries an icon and text,
// and a tooltip spells out what it means. Truncation and latency spread
// come straight off the run itself; empty answers and errored requests
// need the diagnostics file, so those two chips skeleton while it loads
// and simply don't render if it fails -- one failed chip should never
// block the two that don't need it.
export function RunHealthChips({ run, diagnostics }: RunHealthChipsProps) {
  const health = diagnostics.data?.summary.health ?? null
  const latency = run.performance?.latency_seconds ?? null
  const latencyChip = latency ? latencySpreadChip(latency) : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {run.truncation_rate !== null && <Chip chip={truncatedChip(run.truncation_rate)} />}
      {diagnostics.isLoading && <Skeleton className="h-5 w-28 rounded-full" />}
      {health && <Chip chip={emptyAnswersChip(health.empty_answers)} />}
      {diagnostics.isLoading && <Skeleton className="h-5 w-32 rounded-full" />}
      {health && <Chip chip={erroredRequestsChip(health.errored_requests)} />}
      {latencyChip && <Chip chip={latencyChip} />}
    </div>
  )
}
