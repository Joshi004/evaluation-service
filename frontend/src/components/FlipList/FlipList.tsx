import { useState } from 'react'
import { Link } from 'react-router'
import type { FlipSample } from '../../api/client'
import { previewText } from '../../utils/previewText'
import {
  COLLAPSED_FLIP_ROWS,
  flipListHeading,
  flipScoreText,
  visibleFlipSamples,
} from './FlipList.helper'

interface FlipListProps {
  direction: 'fail_to_pass' | 'pass_to_fail'
  samples: FlipSample[]
  leftRunId: number
  rightRunId: number
  showSubsetColumn: boolean
}

// Phase 9's own table (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md):
// ComparePage renders this twice, once per direction. "The flipped
// list is the actual diff of a training change"
// (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4, "Sideways") -- every row
// deep-links to Phase 7's sample page on *each side's own run*, since
// the same sample_key can carry a different answer on each one.
export function FlipList({
  direction,
  samples,
  leftRunId,
  rightRunId,
  showSubsetColumn,
}: FlipListProps) {
  const [expanded, setExpanded] = useState(false)

  // Rendered per-direction by ComparePage regardless of whether that
  // direction actually flipped anything -- a run with zero regressions
  // should show nothing here, not an empty table with headers.
  if (samples.length === 0) {
    return null
  }

  const visible = visibleFlipSamples(samples, expanded)

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-slate-300">
        {flipListHeading(direction, samples.length)}
      </h3>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Key</th>
            {showSubsetColumn && (
              <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                Subset
              </th>
            )}
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
              Input
            </th>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
              Run #{leftRunId}
            </th>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
              Run #{rightRunId}
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((sample) => (
            <tr key={sample.sample_key}>
              <td className="border-b border-slate-800/50 p-2 font-mono text-slate-200">
                {sample.sample_key}
              </td>
              {showSubsetColumn && (
                <td className="border-b border-slate-800/50 p-2 text-slate-300">{sample.subset}</td>
              )}
              <td
                className="max-w-[18rem] truncate border-b border-slate-800/50 p-2 text-slate-300"
                title={sample.input_preview}
              >
                {previewText(sample.input_preview)}
              </td>
              <td className="max-w-[14rem] border-b border-slate-800/50 p-2">
                <Link
                  to={`/runs/${leftRunId}/samples/${encodeURIComponent(sample.sample_key)}`}
                  className="block truncate text-blue-400 hover:underline"
                  title={sample.left_output_preview}
                >
                  {previewText(sample.left_output_preview)}
                </Link>
                <span className="text-xs text-slate-500">{flipScoreText(sample.left_score)}</span>
              </td>
              <td className="max-w-[14rem] border-b border-slate-800/50 p-2">
                <Link
                  to={`/runs/${rightRunId}/samples/${encodeURIComponent(sample.sample_key)}`}
                  className="block truncate text-blue-400 hover:underline"
                  title={sample.right_output_preview}
                >
                  {previewText(sample.right_output_preview)}
                </Link>
                <span className="text-xs text-slate-500">{flipScoreText(sample.right_score)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {samples.length > COLLAPSED_FLIP_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-medium text-blue-400 hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${samples.length}`}
        </button>
      )}
    </div>
  )
}
