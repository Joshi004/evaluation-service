import { useQuery } from '@tanstack/react-query'
import { apiFetch, type CheckpointListItem, type HealthResponse, type LeaderboardRow } from '../api/client'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { MetricCell } from '../components/MetricCell/MetricCell'
import { buildLeaderboardGrid } from './LeaderboardPage.helper'

function statusColor(value: string) {
  return value === 'ok' ? 'text-emerald-400' : 'text-amber-400'
}

export function LeaderboardPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/health'),
    refetchInterval: 10_000,
  })

  const leaderboard = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => apiFetch<LeaderboardRow[]>('/leaderboard'),
  })

  // Fetched only to resolve checkpoint_id -> display name: the
  // leaderboard query is used verbatim from the spec and returns ids,
  // not names.
  const checkpoints = useQuery({
    queryKey: ['checkpoints'],
    queryFn: () => apiFetch<CheckpointListItem[]>('/checkpoints'),
  })

  const grid =
    leaderboard.data && checkpoints.data ? buildLeaderboardGrid(leaderboard.data, checkpoints.data) : null

  return (
    <div>
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Every checkpoint's most recent finished result per comparison hash. Each column is one comparison
        hash -- same standard AND same resolved sampling profile -- so two runs only ever share a column
        if they measured the same thing; the sampling profile beneath each standard's name is what tells
        two columns for the same benchmark apart.
      </p>

      <div className="mt-6 max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Backend connectivity</h2>

        {health.isLoading && <p className="mt-2 text-sm text-slate-500">Checking…</p>}

        {health.isError && (
          <p className="mt-2 text-sm text-red-400">Could not reach the backend: {String(health.error)}</p>
        )}

        {health.data && (
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              Overall: <span className={statusColor(health.data.status)}>{health.data.status}</span>
            </li>
            {Object.entries(health.data.dependencies).map(([name, value]) => (
              <li key={name}>
                {name}: <span className={statusColor(value)}>{value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        {(leaderboard.isLoading || checkpoints.isLoading) && (
          <p className="text-sm text-slate-500">Loading leaderboard…</p>
        )}

        {(leaderboard.isError || checkpoints.isError) && (
          <p className="text-sm text-red-400">
            Could not load the leaderboard: {String(leaderboard.error ?? checkpoints.error)}
          </p>
        )}

        {grid && grid.rows.length === 0 && <EmptyState message="No results yet" />}

        {grid && grid.rows.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                  Checkpoint
                </th>
                {grid.columns.map((column) => (
                  <th
                    key={column.comparisonHash}
                    className="border-b border-slate-800 p-2 text-right font-medium text-slate-400"
                  >
                    <div>{column.standardLabel}</div>
                    {/* S-D36: the comparison hash is what stops two
                        differently-sampled runs sharing a cell; this
                        label is what stops a reader thinking they
                        should. */}
                    <div className="text-xs font-normal text-slate-500">{column.samplingProfileLabel}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.checkpointId}>
                  <td className="border-b border-slate-800/50 p-2 text-slate-200">{row.checkpointName}</td>
                  {grid.columns.map((column) => {
                    const value = row.cellsByComparisonHash[column.comparisonHash]
                    return value === undefined ? (
                      <td
                        key={column.comparisonHash}
                        className="border-b border-slate-800/50 p-2 text-right text-slate-600"
                      >
                        —
                      </td>
                    ) : (
                      <MetricCell key={column.comparisonHash} value={value} comparisonHash={column.comparisonHash} />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
