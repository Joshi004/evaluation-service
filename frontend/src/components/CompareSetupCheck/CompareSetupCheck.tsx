import { useState } from 'react'
import { AlertTriangle, CircleCheck } from 'lucide-react'
import type { RunDetail } from '../../api/client'
import { cn } from '../../utils/cn'
import { setupMatchForHashes } from '../../utils/compareTray'
import { Card } from '../Card/Card'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { buildSetupDiffTable, differenceSummaryText, setupDifferences } from './CompareSetupCheck.helper'

interface CompareSetupCheckProps {
  // Baseline first.
  runs: RunDetail[]
}

// §8.8 item 3: whether the baseline and every other run share one
// setup, and -- when they don't -- exactly what differs, read straight
// off each run's own resolved standard/sampling/serving (already
// loaded by ComparisonView; no extra request). Uses the same
// setupMatchForHashes the compare tray's own "Setups differ" badge
// calls, so the tray and this page can never disagree.
export function CompareSetupCheck({ runs }: CompareSetupCheckProps) {
  const [expanded, setExpanded] = useState(false)
  const match = setupMatchForHashes(runs.map((run) => run.comparison_hash))

  if (match === 'same') {
    return (
      <Card className="flex items-center gap-2 text-sm">
        <CircleCheck className="h-4 w-4 text-success" aria-hidden="true" />
        <span className="font-medium text-foreground">Same setup</span>
        <span className="text-muted-foreground">Every run shares one benchmark protocol and sampling profile.</span>
      </Card>
    )
  }

  const baseline = runs[0]
  const others = runs.slice(1)
  const diffTable = buildSetupDiffTable(runs)

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
        <span className="font-medium text-foreground">Setups differ</span>
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {others.map((run) => {
          const differences = setupDifferences(baseline, run)
          return (
            <li key={run.id}>
              Run #{run.id}:{' '}
              {differences.length === 0
                ? 'matches the baseline.'
                : differences.map(differenceSummaryText).join(' · ')}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="text-xs font-medium text-primary hover:underline"
      >
        {expanded ? 'Hide differences' : 'Show differences'}
      </button>
      {expanded && (
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>Field</TableHeaderCell>
              {runs.map((run) => (
                <TableHeaderCell key={run.id}>#{run.id}</TableHeaderCell>
              ))}
            </tr>
          </thead>
          <tbody>
            {diffTable.map((row) => (
              <tr key={row.label}>
                <TableCell>{row.label}</TableCell>
                {row.values.map((value, index) => (
                  <TableCell key={index} className={cn(index > 0 && value !== row.values[0] && 'text-warning')}>
                    {value}
                  </TableCell>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}
