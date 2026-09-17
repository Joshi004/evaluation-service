import type { ComparisonBucketDelta } from '../../api/client'
import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'
import { bucketDeltaText } from './ComparisonBucketTable.helper'

interface ComparisonBucketTableProps {
  deltas: ComparisonBucketDelta[]
}

// Phase 9's bucket-delta table (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md):
// Layer 3's per-run breakdown, diffed across two runs. Pre-sorted by the
// backend on |pass_rate_delta|, so the row that moved most sits first
// regardless of level -- rendered only when both runs actually produced
// buckets (ComparePage skips this component entirely otherwise).
export function ComparisonBucketTable({ deltas }: ComparisonBucketTableProps) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-medium text-slate-200">Where the score moved</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Name</th>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
              Level
            </th>
            <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
              Left
            </th>
            <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
              Right
            </th>
            <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
              Delta
            </th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((bucket) => (
            <tr key={`${bucket.level}:${bucket.name}`}>
              <td className="border-b border-slate-800/50 p-2 text-slate-200">{bucket.name}</td>
              <td className="border-b border-slate-800/50 p-2 text-slate-400">{bucket.level}</td>
              <td className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-300">
                {formatFractionAsPercent(bucket.left_pass_rate)}
              </td>
              <td className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-300">
                {formatFractionAsPercent(bucket.right_pass_rate)}
              </td>
              <td className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-100">
                {bucketDeltaText(bucket.pass_rate_delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
