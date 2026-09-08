import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { Benchmark, Checkpoint, EvalRun, LineageEdge, MergeMethod } from '../../data/types'
import { formatValue } from '../ConfidenceInterval/ConfidenceInterval.helper'
import {
  MERGE_METHOD_OPTIONS,
  buildMergedCheckpoint,
  checkMergeCompatibility,
  defaultMergedCheckpointName,
  estimateMergedScores,
} from './MergeDialog.helper'

interface MergeDialogProps {
  checkpointA: Checkpoint
  checkpointB: Checkpoint
  benchmarks: readonly Benchmark[]
  runs: readonly EvalRun[]
  onMerge: (checkpoint: Checkpoint, edges: LineageEdge[]) => void
  onClose: () => void
}

// The Model History page's merge flow (EVAL_SERVICE_PLAN.md Section 14 /
// docs/DATA_MODEL.md's `lineage_op` enum, which already lists 'merge').
// Two phases in one component: configure (method, weight, name, with a
// live-updating estimate) then, after Create is clicked, a success view
// with the deep link that lets the estimate get replaced by a real run.
export function MergeDialog({ checkpointA, checkpointB, benchmarks, runs, onMerge, onClose }: MergeDialogProps) {
  const [method, setMethod] = useState<MergeMethod>('linear')
  const [weightPercentA, setWeightPercentA] = useState(50)
  const [name, setName] = useState(() => defaultMergedCheckpointName(checkpointA, checkpointB))
  const [createdCheckpoint, setCreatedCheckpoint] = useState<Checkpoint | null>(null)

  const compatibility = checkMergeCompatibility(checkpointA, checkpointB)
  const estimatedScores = useMemo(
    () => (compatibility.isCompatible ? estimateMergedScores(checkpointA, checkpointB, weightPercentA, benchmarks, runs) : []),
    [compatibility.isCompatible, checkpointA, checkpointB, weightPercentA, benchmarks, runs],
  )

  function handleMerge() {
    const finalName = name.trim() || defaultMergedCheckpointName(checkpointA, checkpointB)
    const { checkpoint, edges } = buildMergedCheckpoint(checkpointA, checkpointB, method, weightPercentA, finalName)
    onMerge(checkpoint, edges)
    setCreatedCheckpoint(checkpoint)
  }

  const submitDeepLink = createdCheckpoint
    ? `/vision/submit?checkpointId=${createdCheckpoint.id}&benchmarkIds=${estimatedScores.map((row) => row.benchmark.id).join(',')}`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-12" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        {createdCheckpoint ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-100">Merged checkpoint created</h2>
              <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close">
                ✕
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              <span className="font-medium text-slate-100">{createdCheckpoint.name}</span> now appears on the graph with the
              estimated scores below. Submit real evals to replace the estimate with measured numbers.
            </p>
            <div className="mt-5">
              <EstimateList estimatedScores={estimatedScores} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Done
              </button>
              {submitDeepLink && (
                <Link
                  to={submitDeepLink}
                  className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
                >
                  Submit evals for real numbers →
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Merge checkpoints</h2>
                <p className="text-sm text-slate-400">
                  {checkpointA.name} + {checkpointB.name}
                </p>
              </div>
              <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close">
                ✕
              </button>
            </div>

            {!compatibility.isCompatible ? (
              <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {compatibility.reason}
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <label className="text-xs text-slate-500" htmlFor="merge-name">
                    Name
                  </label>
                  <input
                    id="merge-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                  />
                </div>

                <div className="mt-4">
                  <span className="text-xs text-slate-500">Method</span>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    {MERGE_METHOD_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMethod(option.value)}
                        className={`rounded-md border px-3 py-2 text-left text-sm ${
                          method === option.value
                            ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                            : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs text-slate-500" htmlFor="merge-weight">
                    Weight — {weightPercentA}% {checkpointA.name} / {100 - weightPercentA}% {checkpointB.name}
                  </label>
                  <input
                    id="merge-weight"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={weightPercentA}
                    onChange={(event) => setWeightPercentA(Number(event.target.value))}
                    className="mt-2 w-full accent-sky-500"
                  />
                </div>

                <div className="mt-5">
                  <h3 className="text-sm font-medium text-slate-300">Estimated scores</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    A weight-interpolated <span className="font-medium text-amber-400">estimate</span>, not a real eval result —
                    merge quality isn't linear in score. Submit evals after creating this checkpoint to replace it with a
                    measured number.
                  </p>
                  <div className="mt-2">
                    <EstimateList estimatedScores={estimatedScores} />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleMerge}
                    className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
                  >
                    Create merged checkpoint
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EstimateList({ estimatedScores }: { estimatedScores: ReturnType<typeof estimateMergedScores> }) {
  if (estimatedScores.length === 0) {
    return <p className="text-sm text-slate-500">Neither checkpoint has a standard, published result to estimate from.</p>
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {estimatedScores.map((row) => (
        <li key={row.benchmark.id} className="flex items-center justify-between gap-3">
          <span className="text-slate-300">
            {row.benchmark.name}
            {!row.hasRealDataForBoth && <span className="ml-1 text-xs text-slate-500">(one side only)</span>}
          </span>
          <span className="font-medium text-amber-300">~{formatValue(row.estimatedValue, row.unit)}</span>
        </li>
      ))}
    </ul>
  )
}
