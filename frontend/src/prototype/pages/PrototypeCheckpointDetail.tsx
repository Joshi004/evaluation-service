import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { benchmarks, getBenchmark } from '../data/benchmarks'
import { getLineageFamily } from '../data/checkpoints'
import { getEdgesWithin, lineageNodePositions } from '../data/lineage'
import { getPrimaryMetricResult } from '../data/runs'
import { usePrototypeStore } from '../state/usePrototypeStore'
import { BenchmarkRadar } from '../components/BenchmarkRadar/BenchmarkRadar'
import { buildRadarPoints } from '../components/BenchmarkRadar/BenchmarkRadar.helper'
import { ConfidenceInterval } from '../components/ConfidenceInterval/ConfidenceInterval'
import { LineageGraph } from '../components/LineageGraph/LineageGraph'
import { StatusBadge } from '../components/StatusBadge/StatusBadge'
import { phaseToLabel, phaseToTone } from '../components/StatusBadge/StatusBadge.helper'
import { getBenchmarksWithFamilyData } from './PrototypeCheckpointDetail.helper'

function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function PrototypeCheckpointDetail() {
  const { checkpointId } = useParams<{ checkpointId: string }>()
  const { runs, checkpoints, lineageEdges } = usePrototypeStore()
  const checkpoint = checkpoints.find((c) => c.id === checkpointId)

  const family = useMemo(
    () => (checkpoint ? getLineageFamily(checkpoints, checkpoint.id) : []),
    [checkpoint, checkpoints],
  )
  const familyIds = useMemo(() => family.map((c) => c.id), [family])
  const familyEdges = useMemo(() => getEdgesWithin(lineageEdges, familyIds), [lineageEdges, familyIds])
  const lineageBenchmarkOptions = useMemo(() => getBenchmarksWithFamilyData(familyIds, runs), [familyIds, runs])

  const [lineageBenchmarkId, setLineageBenchmarkId] = useState<string | null>(null)
  const activeLineageBenchmarkId = lineageBenchmarkId ?? lineageBenchmarkOptions[0]?.id ?? benchmarks[0].id
  const lineageBenchmark = getBenchmark(activeLineageBenchmarkId)

  if (!checkpoint) {
    return (
      <div>
        <p className="text-slate-400">No checkpoint with id "{checkpointId}".</p>
        <Link to="/vision" className="mt-2 inline-block text-sm text-sky-400 hover:underline">
          ← Back to the leaderboard
        </Link>
      </div>
    )
  }

  const checkpointRuns = runs.filter((run) => run.checkpointId === checkpoint.id)
  const publishedRuns = checkpointRuns.filter((run) => run.published)
  const exploratoryRuns = checkpointRuns.filter((run) => !run.isStandard)
  const benchmarksCovered = new Set(publishedRuns.map((run) => run.benchmarkId)).size

  const radarPoints = buildRadarPoints(checkpoint.id, benchmarks, runs)

  return (
    <div>
      <Link to="/vision" className="text-sm text-slate-500 hover:text-slate-300">
        ← Leaderboard
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{checkpoint.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {checkpoint.team} · {checkpoint.sizeParams}
            {checkpoint.quantization ? ` · ${checkpoint.quantization} quantized` : ''} · registered by{' '}
            {checkpoint.registeredBy} on {checkpoint.createdAt}
          </p>
        </div>
        {checkpoint.published && <StatusBadge label="Published model" tone="positive" />}
      </div>
      <p className="mt-3 max-w-2xl text-sm text-slate-400">{checkpoint.notes}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Published benchmarks" value={benchmarksCovered} />
        <StatCard label="Total runs" value={checkpointRuns.length} hint={`${exploratoryRuns.length} exploratory`} />
        <StatCard
          label="Staging"
          value={checkpoint.staged ? 'Ready' : 'Not staged'}
          hint={checkpoint.staged ? `On ${checkpoint.storage.toUpperCase()}` : `Will sync from ${checkpoint.storage.toUpperCase()} on next run`}
        />
        <StatCard label="Lineage" value={checkpoint.lineageOp ?? 'Base'} hint={checkpoint.lineageDetail ?? undefined} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-slate-100">Benchmark families</h2>
          <p className="mt-1 text-sm text-slate-400">Published standard runs only, averaged within a family.</p>
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <BenchmarkRadar points={radarPoints} />
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Lineage</h2>
            {lineageBenchmarkOptions.length > 0 && (
              <select
                value={activeLineageBenchmarkId}
                onChange={(event) => setLineageBenchmarkId(event.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
              >
                {lineageBenchmarkOptions.map((benchmark) => (
                  <option key={benchmark.id} value={benchmark.id}>
                    Label by {benchmark.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Every node is labelled with its {lineageBenchmark.name} score — switch benchmarks to see the same graph
            tell a different story.
          </p>
          <div className="mt-3">
            <LineageGraph
              checkpoints={family}
              positions={lineageNodePositions}
              edges={familyEdges}
              runs={runs}
              benchmarkId={activeLineageBenchmarkId}
              primaryMetricKey={lineageBenchmark.primaryMetricKey}
              unit={lineageBenchmark.metrics.find((m) => m.key === lineageBenchmark.primaryMetricKey)?.unit ?? '%'}
              focusedCheckpointId={checkpoint.id}
            />
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-100">Runs</h2>
        <p className="mt-1 text-sm text-slate-400">Every run on this checkpoint, including exploratory ones that never made the leaderboard.</p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Benchmark</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Result</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Kind</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Phase</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Truncation</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {checkpointRuns.map((run) => {
                const benchmark = getBenchmark(run.benchmarkId)
                const primaryMetricDef = benchmark.metrics.find((m) => m.key === benchmark.primaryMetricKey)
                const result = getPrimaryMetricResult(run, benchmark.primaryMetricKey)
                return (
                  <tr key={run.id} className="border-b border-slate-800/60">
                    <td className="px-4 py-2 font-medium text-slate-200">{benchmark.name}</td>
                    <td className="px-3 py-2">
                      {result ? (
                        <ConfidenceInterval value={result.value} stderr={result.stderr} unit={primaryMetricDef?.unit ?? '%'} />
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {run.isStandard ? (
                        <StatusBadge label="Standard" tone="positive" />
                      ) : (
                        <StatusBadge label="Exploratory" tone={run.flaggedReason ? 'warning' : 'neutral'} />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge label={phaseToLabel(run.phase)} tone={phaseToTone(run.phase)} />
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {run.truncationRate === null ? '—' : `${(run.truncationRate * 100).toFixed(0)}%`}
                      {run.flaggedReason && <span className="ml-1 text-amber-400" title={run.flaggedReason}>⚠</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{run.submittedBy}</td>
                  </tr>
                )
              })}
              {checkpointRuns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No runs yet for this checkpoint.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
