import { useState } from 'react'
import type { FlipSample } from '../../api/client'
import { previewText } from '../../utils/previewText'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { COLLAPSED_FLIP_ROWS, flipListHeading, flipScoreText, visibleFlipSamples } from './FlipList.helper'

interface FlipListProps {
  direction: 'fail_to_pass' | 'pass_to_fail'
  samples: FlipSample[]
  baselineRunId: number
  otherRunId: number
  showSubsetColumn: boolean
  onOpenSample: (sampleKey: string) => void
}

// Compare's own flip table (Phase 8, docs/UI_REDESIGN_PLAN.md §8.8):
// every row is the actual diff of whatever changed between the
// baseline and one other run. Opening a row is how the side-by-side
// dialog (CompareSampleDialog) gets its sample key -- there is no
// per-side link to a separate page any more; the dialog is how a
// flipped sample is read now.
export function FlipList({
  direction,
  samples,
  baselineRunId,
  otherRunId,
  showSubsetColumn,
  onOpenSample,
}: FlipListProps) {
  const [expanded, setExpanded] = useState(false)

  // Rendered per-direction regardless of whether that direction
  // actually flipped anything -- a run with zero regressions should
  // show nothing here, not an empty table with headers.
  if (samples.length === 0) {
    return null
  }

  const visible = visibleFlipSamples(samples, expanded)

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">{flipListHeading(direction, samples.length)}</h3>
      <div className="mt-2">
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>Key</TableHeaderCell>
              {showSubsetColumn && <TableHeaderCell>Subset</TableHeaderCell>}
              <TableHeaderCell>Input</TableHeaderCell>
              <TableHeaderCell>Run #{baselineRunId}</TableHeaderCell>
              <TableHeaderCell>Run #{otherRunId}</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {visible.map((sample) => (
              <tr
                key={sample.sample_key}
                onClick={() => onOpenSample(sample.sample_key)}
                className="cursor-pointer hover:bg-muted"
              >
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpenSample(sample.sample_key)}
                    className="font-mono text-primary hover:underline"
                  >
                    {sample.sample_key}
                  </button>
                </TableCell>
                {showSubsetColumn && <TableCell>{sample.subset}</TableCell>}
                <TableCell className="max-w-[18rem] truncate" title={sample.input_preview}>
                  {previewText(sample.input_preview)}
                </TableCell>
                <TableCell className="max-w-[14rem]">
                  <p className="truncate text-muted-foreground" title={sample.left_output_preview}>
                    {previewText(sample.left_output_preview)}
                  </p>
                  <span className="text-xs text-muted-foreground">{flipScoreText(sample.left_score)}</span>
                </TableCell>
                <TableCell className="max-w-[14rem]">
                  <p className="truncate text-muted-foreground" title={sample.right_output_preview}>
                    {previewText(sample.right_output_preview)}
                  </p>
                  <span className="text-xs text-muted-foreground">{flipScoreText(sample.right_score)}</span>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {samples.length > COLLAPSED_FLIP_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${samples.length}`}
        </button>
      )}
    </div>
  )
}
