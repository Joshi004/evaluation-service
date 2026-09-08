import { Link } from 'react-router'
import type { Benchmark, Checkpoint, EvalRun } from '../../data/types'
import { getPrimaryMetricResult } from '../../data/runs'
import { ConfidenceInterval } from '../ConfidenceInterval/ConfidenceInterval'
import { StatusBadge } from '../StatusBadge/StatusBadge'
import { lineageSummary, stagingSummary } from './CheckpointInspector.helper'

interface CheckpointInspectorProps {
  checkpoint: Checkpoint
  /** Resolved parent Checkpoint objects for a merged checkpoint — empty when `checkpoint.mergedFromIds` is null. */
  mergedFromCheckpoints: Checkpoint[]
  totalRunCount: number
  exploratoryRunCount: number
  /** Each benchmark this checkpoint has a standard, published run for — the same "authoritative cell" the Leaderboard shows, resolved by the page via pickDisplayRun so this panel can never disagree with the grid. */
  benchmarkResults: { benchmark: Benchmark; run: EvalRun }[]
  onClose: () => void
}

// The Model History page's "click a node, see its benchmarks inline"
// panel (EVAL_SERVICE_PLAN.md Section 14). Deliberately a static side
// panel, not a modal like MethodologyPanel — it sits next to the graph so
// clicking around doesn't interrupt looking at it.
export function CheckpointInspector({
  checkpoint,
  mergedFromCheckpoints,
  totalRunCount,
  exploratoryRunCount,
  benchmarkResults,
  onClose,
}: CheckpointInspectorProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-100">{checkpoint.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {checkpoint.team} · {checkpoint.sizeParams}
            {checkpoint.quantization ? ` · ${checkpoint.quantization}` : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-300">
          ✕
        </button>
      </div>

      {checkpoint.published && (
        <div className="mt-2">
          <StatusBadge label="Published model" tone="positive" />
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Lineage</dt>
          <dd className="text-slate-200">{lineageSummary(checkpoint, mergedFromCheckpoints)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Staging</dt>
          <dd className="text-slate-200">{stagingSummary(checkpoint)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Total runs</dt>
          <dd className="text-slate-200">{totalRunCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Exploratory</dt>
          <dd className="text-slate-200">{exploratoryRunCount}</dd>
        </div>
      </dl>

      {checkpoint.lineageDetail && <p className="mt-2 text-xs text-slate-500">{checkpoint.lineageDetail}</p>}

      <div className="mt-4">
        <h4 className="text-xs font-medium text-slate-400">Benchmarks</h4>
        {totalRunCount === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Not evaluated yet.{' '}
            <Link
              to={`/vision/submit?checkpointId=${checkpoint.id}`}
              className="text-sky-400 hover:underline"
            >
              Submit evals
            </Link>{' '}
            to get real numbers here.
          </p>
        ) : benchmarkResults.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No standard, published results yet ({exploratoryRunCount} exploratory run{exploratoryRunCount === 1 ? '' : 's'} on file).
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {benchmarkResults.map(({ benchmark, run }) => {
              const result = getPrimaryMetricResult(run, benchmark.primaryMetricKey)
              const primaryMetricDef = benchmark.metrics.find((metric) => metric.key === benchmark.primaryMetricKey)
              if (!result) return null
              return (
                <li key={benchmark.id} className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">{benchmark.name}</span>
                  <ConfidenceInterval value={result.value} stderr={result.stderr} unit={primaryMetricDef?.unit ?? '%'} />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Link to={`/vision/checkpoints/${checkpoint.id}`} className="mt-4 inline-block text-xs text-sky-400 hover:underline">
        View full checkpoint detail →
      </Link>
    </div>
  )
}
