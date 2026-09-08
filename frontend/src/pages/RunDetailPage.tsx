import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { apiFetch, type RunDetail } from '../api/client'
import { LogStream } from '../components/LogStream/LogStream'
import type { LogSource } from '../components/LogStream/LogStream.helper'
import { PhaseProgress } from '../components/PhaseProgress/PhaseProgress'
import { StatusBadge } from '../components/StatusBadge/StatusBadge'
import { formatElapsedTime } from '../utils/formatElapsedTime'
import { formatFractionAsPercent } from '../utils/formatFractionAsPercent'
import { recipeDisplayName } from '../utils/recipeDisplayName'
import {
  displayOrDash,
  formatTimestamp,
  samplingFieldRows,
  taskFieldRows,
  type FieldRow,
} from './RunDetailPage.helper'

const LOG_SOURCES: { value: LogSource; label: string }[] = [
  { value: 'harness', label: 'Harness' },
  { value: 'endpoint', label: 'Cluster' },
]

// One entity's field/value pairs, e.g. "Created: 2 hours ago" -- as
// opposed to the <table> sections below, which list multiple items
// (metrics). Local to this page: nothing else needs a generic
// label/value grid.
function FieldGrid({ rows }: { rows: FieldRow[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs text-slate-500">{row.label}</dt>
          <dd className="text-slate-200">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const id = Number(runId)
  const [logSource, setLogSource] = useState<LogSource>('harness')

  const run = useQuery({
    queryKey: ['run', id],
    queryFn: () => apiFetch<RunDetail>(`/runs/${id}`),
    enabled: Number.isFinite(id),
    // Keeps status, phase and metrics live while watching a run
    // finish, the same choice RunsPage's list query makes.
    refetchInterval: 5000,
  })

  if (!Number.isFinite(id)) {
    return <p className="text-sm text-red-400">Invalid run id.</p>
  }

  const now = new Date()

  return (
    <div>
      <Link to="/runs" className="text-sm text-blue-400 hover:underline">
        ← Back to runs
      </Link>

      {run.isLoading && <p className="mt-4 text-sm text-slate-500">Loading run…</p>}

      {run.isError && <p className="mt-4 text-sm text-red-400">Could not load run: {String(run.error)}</p>}

      {run.data && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">Run #{run.data.id}</h1>
            <StatusBadge status={run.data.status} />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {run.data.run_group_name} · {run.data.checkpoint_name} ·{' '}
            {recipeDisplayName(run.data.recipe_label, run.data.recipe_hash)}
          </p>

          <div className="mt-4">
            <PhaseProgress status={run.data.status} endpointId={run.data.endpoint_id} />
          </div>

          {run.data.error && (
            <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {run.data.error}
            </p>
          )}

          <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-sm font-medium text-slate-300">Summary</h2>
            <div className="mt-3">
              <FieldGrid
                rows={[
                  { label: 'Submitted by', value: run.data.submitted_by ?? '—' },
                  { label: 'Created', value: formatTimestamp(run.data.created_at) },
                  { label: 'Started', value: formatTimestamp(run.data.started_at) },
                  { label: 'Finished', value: formatTimestamp(run.data.finished_at) },
                  { label: 'Elapsed', value: formatElapsedTime(run.data.created_at, run.data.finished_at, now) },
                  { label: 'Truncation rate', value: formatFractionAsPercent(run.data.truncation_rate) },
                  { label: 'Output directory', value: run.data.output_dir ?? '—' },
                ]}
              />
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-sm font-medium text-slate-300">Endpoint</h2>
            <div className="mt-3">
              {run.data.endpoint === null ? (
                <p className="text-sm text-slate-500">No endpoint yet.</p>
              ) : (
                <FieldGrid
                  rows={[
                    { label: 'URL', value: run.data.endpoint.url ?? '—' },
                    { label: 'SLURM job', value: displayOrDash(run.data.endpoint.slurm_job_id) },
                    { label: 'Expires', value: formatTimestamp(run.data.endpoint.expires_at) },
                  ]}
                />
              )}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-sm font-medium text-slate-300">
              Resolved recipe — {recipeDisplayName(run.data.recipe.label, run.data.recipe.hash)}
            </h2>
            <div className="mt-3">
              <FieldGrid rows={taskFieldRows(run.data.recipe)} />
            </div>
            <div className="mt-4">
              <FieldGrid rows={samplingFieldRows(run.data.recipe)} />
            </div>
            {run.data.recipe.warnings.length > 0 && (
              <ul className="mt-4 space-y-1">
                {run.data.recipe.warnings.map((warning) => (
                  <li key={warning.field} className="text-xs text-amber-400">
                    {warning.field}: {warning.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-sm font-medium text-slate-300">Metrics</h2>
            {run.data.metrics.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No metrics yet.</p>
            ) : (
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Metric
                    </th>
                    <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
                      Value
                    </th>
                    <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
                      Samples
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {run.data.metrics.map((metric) => (
                    <tr key={metric.name}>
                      <td className="border-b border-slate-800/50 p-2 text-slate-200">
                        {metric.name}
                        {metric.is_primary && <span className="ml-2 text-xs text-blue-400">primary</span>}
                      </td>
                      <td className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-100">
                        {formatFractionAsPercent(metric.value)}
                      </td>
                      <td className="border-b border-slate-800/50 p-2 text-right text-slate-300">
                        {metric.n_samples ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-300">Logs</h2>
              <div className="flex gap-1">
                {LOG_SOURCES.map((source) => (
                  <button
                    key={source.value}
                    type="button"
                    onClick={() => setLogSource(source.value)}
                    className={
                      logSource === source.value
                        ? 'rounded bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-300'
                        : 'rounded px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800'
                    }
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              {/* Keyed on run id too, not just source -- RunDetailPage
                  doesn't remount on its own when only the :runId param
                  changes, and LogStream's own docstring calls this out
                  as exactly the case that needs the id in the key. */}
              <LogStream key={`${run.data.id}-${logSource}`} runId={run.data.id} source={logSource} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
