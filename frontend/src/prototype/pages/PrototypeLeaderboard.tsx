import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { EvalRun, Modality, Team } from '../data/types'
import { benchmarks, getBenchmark } from '../data/benchmarks'
import { findCheckpoint } from '../data/checkpoints'
import { getRecipe } from '../data/recipes'
import { getPrimaryMetricResult } from '../data/runs'
import { usePrototypeStore } from '../state/usePrototypeStore'
import { MetricCell } from '../components/MetricCell/MetricCell'
import { MethodologyPanel } from '../components/MethodologyPanel/MethodologyPanel'
import { QualitySpeedScatter } from '../components/QualitySpeedScatter/QualitySpeedScatter'
import { buildScatterPoints } from '../components/QualitySpeedScatter/QualitySpeedScatter.helper'
import {
  filterCheckpointsForLeaderboard,
  pickDisplayRun,
  MODALITY_OPTIONS,
  TEAM_OPTIONS,
  type LeaderboardFilters,
} from './PrototypeLeaderboard.helper'

// Benchmarks where a bigger number is worse (OmniDocBench's edit distance)
// don't belong on a "quality vs. speed, bigger bubble further right and up
// is better" scatter without inverting the axis — simplest to just leave
// them out of the selector.
const scatterEligibleBenchmarks = benchmarks.filter(
  (benchmark) => benchmark.metrics.find((m) => m.key === benchmark.primaryMetricKey)?.higherIsBetter,
)

export function PrototypeLeaderboard() {
  const { runs, checkpoints } = usePrototypeStore()
  const [filters, setFilters] = useState<LeaderboardFilters>({ team: 'all', modality: 'all', standardOnly: true })
  const [scatterBenchmarkId, setScatterBenchmarkId] = useState(scatterEligibleBenchmarks[0].id)
  const [selectedRun, setSelectedRun] = useState<EvalRun | null>(null)

  const visibleCheckpoints = useMemo(
    () => filterCheckpointsForLeaderboard(checkpoints, benchmarks, runs, filters),
    [checkpoints, runs, filters],
  )

  const scatterBenchmark = benchmarks.find((b) => b.id === scatterBenchmarkId) ?? scatterEligibleBenchmarks[0]
  const scatterPoints = useMemo(
    () => buildScatterPoints(scatterBenchmark, checkpoints, runs),
    [scatterBenchmark, checkpoints, runs],
  )
  const selectedRunCheckpoint = selectedRun ? findCheckpoint(checkpoints, selectedRun.checkpointId) : null

  return (
    <div>
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Rows are checkpoints, columns are benchmarks. Every cell is the primary metric with its 95% interval — click
        one to see exactly what produced it.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <select
          value={filters.team}
          onChange={(event) => setFilters((prev) => ({ ...prev, team: event.target.value as Team | 'all' }))}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
        >
          <option value="all">All teams</option>
          {TEAM_OPTIONS.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>

        <select
          value={filters.modality}
          onChange={(event) => setFilters((prev) => ({ ...prev, modality: event.target.value as Modality | 'all' }))}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
        >
          <option value="all">All modalities</option>
          {MODALITY_OPTIONS.map((modality) => (
            <option key={modality} value={modality}>
              {modality}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={filters.standardOnly}
            onChange={(event) => setFilters((prev) => ({ ...prev, standardOnly: event.target.checked }))}
            className="accent-sky-500"
          />
          Standard only
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Checkpoint</th>
              {benchmarks.map((benchmark) => (
                <th key={benchmark.id} className="px-3 py-2 text-left text-xs font-medium text-slate-500">
                  {benchmark.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleCheckpoints.map((checkpoint) => (
              <tr key={checkpoint.id} className="border-b border-slate-800/60">
                <td className="px-4 py-2">
                  <Link to={`/vision/checkpoints/${checkpoint.id}`} className="font-medium text-slate-100 hover:underline">
                    {checkpoint.name}
                  </Link>
                  <div className="text-xs text-slate-500">{checkpoint.team}</div>
                </td>
                {benchmarks.map((benchmark) => {
                  const run = pickDisplayRun(checkpoint.id, benchmark.id, runs, filters.standardOnly)
                  const primaryMetricDef = benchmark.metrics.find((m) => m.key === benchmark.primaryMetricKey)
                  const result = run ? getPrimaryMetricResult(run, benchmark.primaryMetricKey) : null
                  return (
                    <td key={benchmark.id} className="px-3 py-2">
                      <MetricCell
                        run={run}
                        value={result?.value ?? null}
                        stderr={result?.stderr ?? null}
                        unit={primaryMetricDef?.unit ?? '%'}
                        onSelect={setSelectedRun}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
            {visibleCheckpoints.length === 0 && (
              <tr>
                <td colSpan={benchmarks.length + 1} className="px-4 py-6 text-center text-slate-500">
                  No checkpoints match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Quality vs. speed</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              We host the models ourselves, so we can report what a hosted-API leaderboard can't: how fast a
              checkpoint actually runs on our own H100s, and what it cost to find out. Bubble size is GPU-hours.
            </p>
          </div>
          <select
            value={scatterBenchmarkId}
            onChange={(event) => setScatterBenchmarkId(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
          >
            {scatterEligibleBenchmarks.map((benchmark) => (
              <option key={benchmark.id} value={benchmark.id}>
                {benchmark.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <QualitySpeedScatter points={scatterPoints} benchmarkName={scatterBenchmark.name} />
        </div>
      </section>

      {selectedRun && selectedRunCheckpoint && (
        <MethodologyPanel
          run={selectedRun}
          benchmark={getBenchmark(selectedRun.benchmarkId)}
          recipe={getRecipe(selectedRun.benchmarkId)}
          checkpoint={selectedRunCheckpoint}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </div>
  )
}
