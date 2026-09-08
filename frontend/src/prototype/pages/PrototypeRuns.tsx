import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getBenchmark } from '../data/benchmarks'
import { findCheckpoint } from '../data/checkpoints'
import { usePrototypeStore } from '../state/usePrototypeStore'
import { LogStream } from '../components/LogStream/LogStream'
import { PhaseProgress } from '../components/PhaseProgress/PhaseProgress'
import { StatusBadge } from '../components/StatusBadge/StatusBadge'
import { formatElapsed, isTruncationFlagged, sortRunsByRecency } from './PrototypeRuns.helper'

const ELAPSED_TICK_MS = 1000

export function PrototypeRuns() {
  const { runs, checkpoints, logsByRunId, resetDemo } = usePrototypeStore()
  const [now, setNow] = useState(() => Date.now())
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS)
    return () => clearInterval(interval)
  }, [])

  const sortedRuns = useMemo(() => sortRunsByRecency(runs), [runs])

  const activeRun = sortedRuns.find((run) => run.phase !== 'completed' && run.phase !== 'failed')
  const selectedRun = sortedRuns.find((run) => run.id === selectedRunId) ?? activeRun ?? sortedRuns[0] ?? null
  const selectedRunCheckpoint = selectedRun ? findCheckpoint(checkpoints, selectedRun.checkpointId) : null

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Runs</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Every run submitted this session, moving through queued → staging → waiting for an endpoint → inference →
            scoring → completed on a compressed timeline.
          </p>
        </div>
        <button
          type="button"
          onClick={resetDemo}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Reset demo
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Run</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Phase</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Elapsed</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Truncation</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Error rate</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Kind</th>
            </tr>
          </thead>
          <tbody>
            {sortedRuns.map((run) => {
              const checkpoint = findCheckpoint(checkpoints, run.checkpointId)
              const benchmark = getBenchmark(run.benchmarkId)
              const flagged = isTruncationFlagged(run)
              const isSelected = run.id === selectedRun?.id

              if (!checkpoint) return null

              return (
                <tr
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`cursor-pointer border-b border-slate-800/60 ${isSelected ? 'bg-slate-800/50' : 'hover:bg-slate-900'}`}
                >
                  <td className="px-4 py-2">
                    <Link
                      to={`/vision/checkpoints/${checkpoint.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="font-medium text-slate-100 hover:underline"
                    >
                      {checkpoint.name}
                    </Link>
                    <div className="text-xs text-slate-500">{benchmark.name}</div>
                  </td>
                  <td className="px-3 py-2">
                    <PhaseProgress currentPhase={run.phase} includeStaging={!checkpoint.staged} />
                  </td>
                  <td className="px-3 py-2 text-slate-300">{formatElapsed(run, now)}</td>
                  <td className="px-3 py-2">
                    {run.truncationRate === null ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <span className={flagged ? 'font-medium text-amber-400' : 'text-slate-300'}>
                        {(run.truncationRate * 100).toFixed(0)}%{flagged && ' ⚠'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {run.errorRate === null ? <span className="text-slate-600">—</span> : `${(run.errorRate * 100).toFixed(0)}%`}
                  </td>
                  <td className="px-3 py-2">
                    {run.isStandard ? (
                      <StatusBadge label="Standard" tone="positive" />
                    ) : (
                      <StatusBadge label="Exploratory" tone={run.flaggedReason ? 'warning' : 'neutral'} />
                    )}
                  </td>
                </tr>
              )
            })}
            {sortedRuns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No runs yet — submit something from the Submit page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRun && selectedRunCheckpoint && (
        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-slate-300">
              Log — {selectedRunCheckpoint.name} · {getBenchmark(selectedRun.benchmarkId).name}
            </h2>
            {selectedRun.slurmJobId && <span className="text-xs text-slate-500">job {selectedRun.slurmJobId}</span>}
          </div>
          <div className="mt-2">
            <LogStream lines={logsByRunId[selectedRun.id] ?? []} />
          </div>
        </section>
      )}
    </div>
  )
}
