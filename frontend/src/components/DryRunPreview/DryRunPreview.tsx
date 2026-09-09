import type { RunPreview, StandardRecipe } from '../../api/client'
import { formatPreviewValue, groupFindingsByCode, type GroupedFinding } from './DryRunPreview.helper'

interface DryRunPreviewProps {
  preview: RunPreview | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  recipesById: Map<number, StandardRecipe>
}

interface FindingGroupItemProps {
  finding: GroupedFinding
  textClassName: string
}

// One collapsed finding: its message once, plus which pairs it applies
// to -- inline when there's only one, behind a <details> toggle when a
// grid-wide finding would otherwise repeat itself for every pair it hit.
function FindingGroupItem({ finding, textClassName }: FindingGroupItemProps) {
  return (
    <li className={`text-xs ${textClassName}`}>
      {finding.message}
      {finding.pairLabels.length === 1 ? (
        <span className="ml-1 text-slate-500">({finding.pairLabels[0]})</span>
      ) : (
        <details className="mt-0.5">
          <summary className="cursor-pointer text-slate-500">
            {finding.pairLabels.length} pairs affected
          </summary>
          <ul className="mt-1 ml-4 list-disc space-y-0.5 text-slate-500">
            {finding.pairLabels.map((pairLabel) => (
              <li key={pairLabel}>{pairLabel}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

// Everything Submit needs to show before anything POSTs: how many runs
// and GPUs (Trap T1 -- GPUs are per distinct checkpoint, not per run,
// so this is the one number a human will actually act on), which
// findings block or merely warn and why, and what each selected
// recipe's overrides would actually resolve to. All of it comes
// straight from POST /runs/preview (backend/app/services/runs/preview.py)
// -- this component never recomputes any of it, so Submit and the
// Standards page can never disagree about what a value does.
export function DryRunPreview({ preview, isLoading, isError, error, recipesById }: DryRunPreviewProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Checking…</p>
  }

  if (isError) {
    return <p className="text-sm text-red-400">Could not load preview: {String(error)}</p>
  }

  if (!preview) {
    return <p className="text-sm text-slate-500">Select at least one checkpoint and one recipe.</p>
  }

  const groupedErrors = groupFindingsByCode(preview.pairs, 'errors')
  const groupedWarnings = groupFindingsByCode(preview.pairs, 'warnings')

  return (
    <div>
      <p className="text-sm text-slate-200">
        <span className="font-medium">{preview.run_count}</span> run{preview.run_count === 1 ? '' : 's'}{' '}
        across <span className="font-medium">{preview.gpu_count}</span> GPU
        {preview.gpu_count === 1 ? '' : 's'}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        GPUs are counted per distinct checkpoint -- benchmarks against one checkpoint share one server.
      </p>

      {groupedErrors.length > 0 && (
        <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm font-medium text-red-300">
            {groupedErrors.length} problem{groupedErrors.length === 1 ? '' : 's'} block this submission
          </p>
          <ul className="mt-2 space-y-1">
            {groupedErrors.map((finding) => (
              <FindingGroupItem
                key={`${finding.code}-${finding.field}-${finding.message}`}
                finding={finding}
                textClassName="text-red-400"
              />
            ))}
          </ul>
        </div>
      )}

      {groupedWarnings.length > 0 && (
        <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm font-medium text-amber-300">
            {groupedWarnings.length} warning{groupedWarnings.length === 1 ? '' : 's'} -- recorded, does not
            block submitting
          </p>
          <ul className="mt-2 space-y-1">
            {groupedWarnings.map((finding) => (
              <FindingGroupItem
                key={`${finding.code}-${finding.field}-${finding.message}`}
                finding={finding}
                textClassName="text-amber-400"
              />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {preview.resolved_recipes.map((resolved) => {
          const baseRecipe = recipesById.get(resolved.base_recipe_id)
          return (
            <div
              key={resolved.base_recipe_id}
              className="rounded border border-slate-800 bg-slate-950 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-200">{baseRecipe?.label ?? resolved.base_recipe_id}</span>
                <span className="font-mono text-xs text-slate-500">→ {resolved.hash}</span>
                <span
                  className={
                    resolved.is_new_recipe
                      ? 'rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-300'
                      : 'rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400'
                  }
                >
                  {resolved.is_new_recipe ? 'new recipe, no label' : 'reuses existing recipe'}
                </span>
              </div>

              {resolved.changed_fields.length > 0 && (
                <table className="mt-2 w-full border-collapse text-xs">
                  <tbody>
                    {resolved.changed_fields.map((change) => (
                      <tr key={change.field}>
                        <td className="py-0.5 pr-2 text-slate-500">{change.field}</td>
                        <td className="py-0.5 pr-2 font-mono text-slate-500 line-through">
                          {formatPreviewValue(change.base_value)}
                        </td>
                        <td className="py-0.5 font-mono text-slate-200">
                          {formatPreviewValue(change.override_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
