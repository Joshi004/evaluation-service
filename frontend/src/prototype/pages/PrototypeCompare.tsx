import { useMemo, useState } from 'react'
import { benchmarks, getBenchmark } from '../data/benchmarks'
import { getPredictionDiffRows, hasPredictionDiff } from '../data/predictions'
import { getPrimaryMetricResult } from '../data/runs'
import type { Benchmark, Checkpoint, EvalRun } from '../data/types'
import { usePrototypeStore } from '../state/usePrototypeStore'
import { ConfidenceInterval } from '../components/ConfidenceInterval/ConfidenceInterval'
import type { MetricUnit } from '../components/ConfidenceInterval/ConfidenceInterval.helper'
import { PredictionDiffTable } from '../components/PredictionDiffTable/PredictionDiffTable'
import {
  MAX_COMPARE_CHECKPOINTS,
  MIN_COMPARE_CHECKPOINTS,
  computeTwoWayDelta,
  deltaTone,
  deltaToneClass,
  formatDeltaMagnitude,
  getComparableBenchmarks,
  getComparisonRun,
} from './PrototypeCompare.helper'

// The pair with real stored predictions — selecting it by default means
// the per-question diff table has something to show the moment the page
// loads, instead of an empty state.
const DEFAULT_SELECTED_IDS = ['qwen3-4b-rl-step400', 'qwen3-4b-allternary-ep03']

export function PrototypeCompare() {
  const { runs, checkpoints } = usePrototypeStore()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(DEFAULT_SELECTED_IDS))

  function toggleCheckpoint(checkpointId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(checkpointId)) {
        next.delete(checkpointId)
      } else if (next.size < MAX_COMPARE_CHECKPOINTS) {
        next.add(checkpointId)
      }
      return next
    })
  }

  // Store order (fixtures, then any merges in creation order), not click
  // order — so re-ticking the same two boxes in a different order never
  // flips which checkpoint is "A" and which is "B".
  const selectedCheckpoints = useMemo(() => checkpoints.filter((c) => selectedIds.has(c.id)), [checkpoints, selectedIds])
  const selectedCheckpointIds = useMemo(() => selectedCheckpoints.map((c) => c.id), [selectedCheckpoints])
  const comparableBenchmarks = useMemo(
    () => getComparableBenchmarks(selectedCheckpointIds, benchmarks, runs),
    [selectedCheckpointIds, runs],
  )

  const hasEnoughSelected = selectedCheckpoints.length >= MIN_COMPARE_CHECKPOINTS
  const isTwoWay = selectedCheckpoints.length === 2
  const [checkpointA, checkpointB] = selectedCheckpoints

  return (
    <div>
      <h1 className="text-2xl font-semibold">Compare</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Pick {MIN_COMPARE_CHECKPOINTS} to {MAX_COMPARE_CHECKPOINTS} checkpoints. Every number is the standard,
        published run, and with exactly two selected, deltas are shown against their combined 95% interval — so a
        difference inside the noise reads as inside the noise.
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-100">Checkpoints</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {checkpoints.map((checkpoint) => {
            const isSelected = selectedIds.has(checkpoint.id)
            const isDisabled = !isSelected && selectedIds.size >= MAX_COMPARE_CHECKPOINTS
            return (
              <button
                key={checkpoint.id}
                type="button"
                onClick={() => toggleCheckpoint(checkpoint.id)}
                disabled={isDisabled}
                className={
                  isSelected
                    ? 'rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-sm font-medium text-sky-300'
                    : isDisabled
                      ? 'cursor-not-allowed rounded-full border border-slate-800 px-3 py-1.5 text-sm text-slate-600'
                      : 'rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800'
                }
              >
                {checkpoint.name}
              </button>
            )
          })}
        </div>
        {!hasEnoughSelected && (
          <p className="mt-3 text-sm text-amber-400">Select at least {MIN_COMPARE_CHECKPOINTS} checkpoints to compare.</p>
        )}
      </section>

      {hasEnoughSelected && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-100">Metric deltas</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Benchmark</th>
                  {selectedCheckpoints.map((checkpoint) => (
                    <th key={checkpoint.id} className="px-3 py-2 text-left text-xs font-medium text-slate-500">
                      {checkpoint.name}
                    </th>
                  ))}
                  {isTwoWay && (
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">
                      Δ ({checkpointB.name} vs {checkpointA.name})
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {comparableBenchmarks.map((benchmark) => {
                  const primaryMetricDef = benchmark.metrics.find((m) => m.key === benchmark.primaryMetricKey)
                  const unit: MetricUnit = primaryMetricDef?.unit ?? '%'
                  const runsByCheckpoint = selectedCheckpoints.map((checkpoint) =>
                    getComparisonRun(checkpoint.id, benchmark.id, runs),
                  )
                  return (
                    <tr key={benchmark.id} className="border-b border-slate-800/60">
                      <td className="px-4 py-2 font-medium text-slate-200">{benchmark.name}</td>
                      {runsByCheckpoint.map((run, index) => (
                        <td key={selectedCheckpoints[index].id} className="px-3 py-2">
                          <MetricValueCell run={run} primaryMetricKey={benchmark.primaryMetricKey} unit={unit} />
                        </td>
                      ))}
                      {isTwoWay && (
                        <td className="px-3 py-2">
                          <DeltaCell
                            benchmark={benchmark}
                            runA={runsByCheckpoint[0]}
                            runB={runsByCheckpoint[1]}
                            higherIsBetter={primaryMetricDef?.higherIsBetter ?? true}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
                {comparableBenchmarks.length === 0 && (
                  <tr>
                    <td
                      colSpan={selectedCheckpoints.length + 1 + (isTwoWay ? 1 : 0)}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      None of the selected checkpoints have a standard, published run yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isTwoWay && hasPredictionDiff(checkpointA.id, checkpointB.id) && (
        <PerQuestionDiffSection checkpointA={checkpointA} checkpointB={checkpointB} />
      )}
    </div>
  )
}

function PerQuestionDiffSection({ checkpointA, checkpointB }: { checkpointA: Checkpoint; checkpointB: Checkpoint }) {
  const rows = getPredictionDiffRows(checkpointA.id, checkpointB.id)
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-100">Per-question diff — IFEval</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-400">
        A {rows.length}-question illustrative slice — a real run stores all {getBenchmark('ifeval').questionCount}.
        Not one-sided: includes questions where {checkpointB.name} regresses and questions where both models fail
        the same instruction.
      </p>
      <div className="mt-3">
        <PredictionDiffTable rows={rows} checkpointAName={checkpointA.name} checkpointBName={checkpointB.name} />
      </div>
    </section>
  )
}

function MetricValueCell({
  run,
  primaryMetricKey,
  unit,
}: {
  run: EvalRun | null
  primaryMetricKey: string
  unit: MetricUnit
}) {
  if (!run) return <span className="text-slate-600">—</span>
  const result = getPrimaryMetricResult(run, primaryMetricKey)
  if (!result) return <span className="text-slate-600">—</span>
  return <ConfidenceInterval value={result.value} stderr={result.stderr} unit={unit} />
}

function DeltaCell({
  benchmark,
  runA,
  runB,
  higherIsBetter,
}: {
  benchmark: Benchmark
  runA: EvalRun | null
  runB: EvalRun | null
  higherIsBetter: boolean
}) {
  if (!runA || !runB) return <span className="text-slate-600">—</span>
  const delta = computeTwoWayDelta(benchmark, runA, runB)
  if (!delta) return <span className="text-slate-600">—</span>

  const tone = deltaTone(delta, higherIsBetter)
  const toneClass = deltaToneClass(tone)
  return (
    <span className={`text-sm font-medium ${toneClass}`}>
      {formatDeltaMagnitude(delta)}
      <span className="ml-1 text-xs font-normal text-slate-500">
        {delta.isOutsideNoise ? '(likely real)' : '(within noise)'}
      </span>
    </span>
  )
}
