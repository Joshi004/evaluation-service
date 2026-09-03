import { useQuery } from '@tanstack/react-query'
import { apiFetch, type HealthResponse } from '../api/client'

function statusColor(value: string) {
  return value === 'ok' ? 'text-emerald-400' : 'text-amber-400'
}

export function LeaderboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/health'),
    refetchInterval: 10_000,
  })

  return (
    <div>
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        The front door. Rows are (checkpoint, mode) pairs, columns are
        benchmarks, grouped by <code>profile_hash</code>. See
        EVAL_SERVICE_PLAN.md, Section 14. Not implemented yet.
      </p>

      <div className="mt-6 max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Backend connectivity</h2>

        {isLoading && <p className="mt-2 text-sm text-slate-500">Checking…</p>}

        {isError && (
          <p className="mt-2 text-sm text-red-400">
            Could not reach the backend: {String(error)}
          </p>
        )}

        {data && (
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              Overall: <span className={statusColor(data.status)}>{data.status}</span>
            </li>
            {Object.entries(data.dependencies).map(([name, value]) => (
              <li key={name}>
                {name}: <span className={statusColor(value)}>{value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
