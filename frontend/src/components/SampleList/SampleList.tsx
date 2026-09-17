import { Link } from 'react-router'
import type { DiagnosticsSample } from '../../api/client'
import { previewText } from '../../utils/previewText'
import { tagLabel } from '../../utils/tagLabel'
import { outcomeBadge, primaryScoreText } from './SampleList.helper'

interface SampleListProps {
  runId: number
  samples: DiagnosticsSample[]
  primaryMetricName: string
  primaryMetricDisplayName: string
  showSubsetColumn: boolean
}

// Layer 4's table (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 4):
// renders whichever page of already-filtered samples the caller
// fetched. Every row deep-links to /runs/:runId/samples/:sampleKey --
// "a URL you can paste into Slack and have a colleague land on the
// exact question" (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4, Layer 4)
// is most of what makes this table useful rather than a static report.
export function SampleList({
  runId,
  samples,
  primaryMetricName,
  primaryMetricDisplayName,
  showSubsetColumn,
}: SampleListProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Key</th>
          {showSubsetColumn && (
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
              Subset
            </th>
          )}
          <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
            Outcome
          </th>
          <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Tags</th>
          <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Input</th>
          <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Output</th>
          <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
            {primaryMetricDisplayName}
          </th>
        </tr>
      </thead>
      <tbody>
        {samples.map((sample) => {
          const badge = outcomeBadge(sample.passed)
          return (
            <tr key={sample.sample_key}>
              <td className="border-b border-slate-800/50 p-2">
                <Link
                  to={`/runs/${runId}/samples/${encodeURIComponent(sample.sample_key)}`}
                  className="text-blue-400 hover:underline"
                >
                  {sample.sample_key}
                </Link>
              </td>
              {showSubsetColumn && (
                <td className="border-b border-slate-800/50 p-2 text-slate-300">{sample.subset}</td>
              )}
              <td className="border-b border-slate-800/50 p-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
              </td>
              <td className="border-b border-slate-800/50 p-2">
                <div className="flex flex-wrap gap-1">
                  {sample.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                    >
                      {tagLabel(tag)}
                    </span>
                  ))}
                </div>
              </td>
              <td
                className="max-w-[24rem] truncate border-b border-slate-800/50 p-2 text-slate-300"
                title={sample.input_preview}
              >
                {previewText(sample.input_preview)}
              </td>
              <td
                className="max-w-[24rem] truncate border-b border-slate-800/50 p-2 text-slate-300"
                title={sample.output_preview}
              >
                {previewText(sample.output_preview)}
              </td>
              <td className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-100">
                {primaryScoreText(sample.scores, primaryMetricName)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
