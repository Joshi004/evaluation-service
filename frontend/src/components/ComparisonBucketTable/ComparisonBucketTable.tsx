import { useState } from 'react'
import type { RunDetail } from '../../api/client'
import type { ComparePairState } from '../../utils/compareRuns'
import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'
import { formatScoreDelta } from '../../utils/formatScore'
import { SegmentedControl } from '../SegmentedControl/SegmentedControl'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import {
  availableBucketLevels,
  bucketUnitLabel,
  buildMergedBucketRows,
  comparableBucketPairs,
  resolveBucketLevel,
  visibleBucketRows,
} from './ComparisonBucketTable.helper'

interface ComparisonBucketTableProps {
  otherRuns: RunDetail[]
  pairs: ComparePairState[]
  level: string | null
  onLevelChange: (level: string) => void
}

// Bucket-delta table merged across every comparable pair by (level,
// name) -- the old two-run table, now with one Δ column per
// non-baseline run instead of exactly one.
export function ComparisonBucketTable({ otherRuns, pairs, level, onLevelChange }: ComparisonBucketTableProps) {
  const [expanded, setExpanded] = useState(false)
  const bucketPairs = comparableBucketPairs(pairs)
  const availableLevels = availableBucketLevels(bucketPairs)

  // Nothing has produced a breakdown yet (every pair still loading,
  // refused, or a benchmark with no buckets at all, e.g. GSM8K) --
  // rendered only once there is something to show, the same rule the
  // single-pair table always followed.
  if (availableLevels.length === 0) {
    return null
  }

  const effectiveLevel = resolveBucketLevel(level, availableLevels)
  if (effectiveLevel === null) {
    return null
  }

  const rows = buildMergedBucketRows(bucketPairs, effectiveLevel)
  const visibleRows = visibleBucketRows(rows, expanded)
  const unit = bucketUnitLabel(effectiveLevel)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Where the score moved</h2>
        {availableLevels.length > 1 && (
          <SegmentedControl
            value={effectiveLevel}
            onValueChange={onLevelChange}
            options={availableLevels.map((candidate) => ({ value: candidate, label: candidate }))}
            aria-label="Bucket level"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">Counted in {unit}; rows don't add up to the total.</p>
      <Table>
        <thead>
          <tr>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell className="text-right">Baseline</TableHeaderCell>
            {otherRuns.map((run) => (
              <TableHeaderCell key={run.id} className="text-right">
                #{run.id} Δ
              </TableHeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.name}>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {row.baselinePassRate === null ? '—' : formatFractionAsPercent(row.baselinePassRate)}
              </TableCell>
              {otherRuns.map((run) => {
                const cell = row.perRun.find((entry) => entry.runId === run.id)
                return (
                  <TableCell key={run.id} className="text-right font-mono tabular-nums">
                    {cell && cell.delta !== null ? formatScoreDelta(cell.delta) : '—'}
                  </TableCell>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length > visibleRows.length && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs font-medium text-primary hover:underline"
        >
          Show all {rows.length}
        </button>
      )}
    </div>
  )
}
