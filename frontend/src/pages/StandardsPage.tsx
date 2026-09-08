import { useQuery } from '@tanstack/react-query'
import { apiFetch, type StandardRecipe } from '../api/client'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { buildFieldRows } from './StandardsPage.helper'

export function StandardsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['standards'],
    queryFn: () => apiFetch<StandardRecipe[]>('/standards'),
  })

  return (
    <div>
      <h1 className="text-2xl font-semibold">Standards / Methodology</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Every reviewed recipe: what it measures, every setting, and where each one came from. The hash
        is what makes two results comparable -- two runs sharing a hash were produced identically.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading standards…</p>}

      {isError && <p className="mt-6 text-sm text-red-400">Could not load standards: {String(error)}</p>}

      {data && data.length === 0 && (
        <div className="mt-6">
          <EmptyState message="No standards loaded yet" />
        </div>
      )}

      {data && data.length > 0 && (
        <div className="mt-6 space-y-10">
          {data.map((standard) => (
            <StandardSection key={standard.id} standard={standard} />
          ))}
        </div>
      )}
    </div>
  )
}

function StandardSection({ standard }: { standard: StandardRecipe }) {
  const fieldRows = buildFieldRows(standard)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-medium text-slate-100">{standard.label}</h2>
        <span
          className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300"
          title="Recipe hash -- identical hashes were produced by the exact same recipe"
        >
          {standard.hash}
        </span>
        <span className="text-sm text-slate-500">
          {standard.benchmark} · {standard.framework} · {standard.framework_image} · {standard.task_name}
        </span>
      </header>

      <h3 className="mt-5 text-sm font-medium text-slate-400">Metrics</h3>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Name</th>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
              Harness key
            </th>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
              Higher is better
            </th>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Primary</th>
          </tr>
        </thead>
        <tbody>
          {standard.metrics.map((metric) => (
            <tr key={metric.name}>
              <td className="border-b border-slate-800/50 p-2 text-slate-200">{metric.display_name}</td>
              <td className="border-b border-slate-800/50 p-2 font-mono text-xs text-slate-400">
                {metric.harness_key}
              </td>
              <td className="border-b border-slate-800/50 p-2 text-slate-300">
                {metric.higher_is_better ? 'yes' : 'no'}
              </td>
              <td className="border-b border-slate-800/50 p-2 text-slate-300">
                {metric.is_primary ? 'primary' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-6 text-sm font-medium text-slate-400">Configuration</h3>
      <table className="mt-2 w-full border-collapse text-sm">
        <tbody>
          {fieldRows.map((row) => (
            <tr key={row.field}>
              <td className="w-48 border-b border-slate-800/50 p-2 align-top text-slate-400">
                {row.label}
              </td>
              <td className="border-b border-slate-800/50 p-2 align-top font-mono text-slate-100">
                {row.value}
                {row.warning && (
                  <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 font-sans text-xs text-amber-300">
                    {row.warning}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {standard.source_yaml && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-200">
            Source YAML
          </summary>
          <pre className="mt-2 overflow-x-auto rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
            {standard.source_yaml}
          </pre>
        </details>
      )}
    </section>
  )
}
