import type { InferredField } from './InspectionSummary.helper'

interface InspectionSummaryProps {
  fields: InferredField[]
  problems: string[]
  sourceConfig: Record<string, unknown> | null
}

// Step 2 of the registration wizard: every field the server inferred
// from the cluster, plus anything it could not read. Every field here
// is read-only -- the server re-reads the checkpoint at registration
// regardless of what the form shows (R-D4), so nothing here is wired to
// an onChange.
export function InspectionSummary({ fields, problems, sourceConfig }: InspectionSummaryProps) {
  return (
    <div>
      {problems.length > 0 && (
        <div className="mb-4 rounded border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm font-medium text-amber-300">
            {problems.length} thing{problems.length === 1 ? '' : 's'} could not be read
          </p>
          <ul className="mt-1 space-y-0.5">
            {problems.map((problem) => (
              <li key={problem} className="text-xs text-amber-400">
                {problem}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs text-slate-500">{field.label}</dt>
            <dd className="text-sm text-slate-200">{field.value}</dd>
          </div>
        ))}
      </dl>

      {sourceConfig && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
            config.json (verbatim)
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-400">
            {JSON.stringify(sourceConfig, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
