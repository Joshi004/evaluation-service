import type { PredictionDiffRow } from '../../data/predictions'
import type { PredictionExample } from '../../data/types'
import { StatusBadge } from '../StatusBadge/StatusBadge'
import { computeDiffVerdict, verdictLabel, verdictTone } from './PredictionDiffTable.helper'

interface PredictionDiffTableProps {
  rows: PredictionDiffRow[]
  checkpointAName: string
  checkpointBName: string
}

// Per-question diff: every row is a shared prompt, both models' actual
// responses side by side, and a verdict badge — including "both pass" and
// "both fail" rows, not just the cases where one model beats the other.
export function PredictionDiffTable({ rows, checkpointAName, checkpointBName }: PredictionDiffTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900">
            <th className="w-[22%] px-4 py-2 text-left text-xs font-medium text-slate-500">Prompt</th>
            <th className="w-[13%] px-3 py-2 text-left text-xs font-medium text-slate-500">Verdict</th>
            <th className="w-[32.5%] px-3 py-2 text-left text-xs font-medium text-slate-500">{checkpointAName}</th>
            <th className="w-[32.5%] px-3 py-2 text-left text-xs font-medium text-slate-500">{checkpointBName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const verdict = computeDiffVerdict(row)
            return (
              <tr key={row.questionId} className="border-b border-slate-800/60 align-top">
                <td className="px-4 py-3 text-slate-300">{row.prompt}</td>
                <td className="px-3 py-3">
                  <StatusBadge label={verdictLabel(verdict, checkpointAName, checkpointBName)} tone={verdictTone(verdict)} />
                </td>
                <td className="px-3 py-3">
                  <ResponseCell prediction={row.a} />
                </td>
                <td className="px-3 py-3">
                  <ResponseCell prediction={row.b} />
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                No stored predictions for this pair.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ResponseCell({ prediction }: { prediction: PredictionExample | undefined }) {
  if (!prediction) {
    return <span className="text-slate-600">—</span>
  }
  return (
    <div>
      <span className={prediction.correct ? 'text-xs font-medium text-emerald-400' : 'text-xs font-medium text-red-400'}>
        {prediction.correct ? '✓ correct' : '✗ incorrect'}
      </span>
      <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs text-slate-400">{prediction.response}</p>
    </div>
  )
}
