import type {
  CheckpointListItem,
  FieldChange,
  ResolvedStandardPreview,
  RunPreview,
  SamplingOverrides,
  SamplingProfileSummary,
  StandardSummary,
} from '../../api/client'
import {
  comparisonHashByPair,
  formatPreviewValue,
  groupFindingsByCode,
  type GroupedFinding,
} from './DryRunPreview.helper'
import { ResolvedSamplingCard } from './ResolvedSamplingCard'

interface DryRunPreviewProps {
  preview: RunPreview | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  standardsById: Map<number, StandardSummary>
  checkpointsById: Map<number, CheckpointListItem>
  samplingProfilesById: Map<number, SamplingProfileSummary>
  // The submit's own sampling overrides (OverrideEditor's sampling
  // half) -- the same object for every card, since S-D35 applies one
  // sampling choice to the whole grid, not one per pair.
  userSamplingOverrides: SamplingOverrides
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

// The before/after table shared by a resolved standard's card here and
// a resolved sampling profile's card (ResolvedSamplingCard.tsx) -- both
// are just "a base config, merged with overrides" (FieldChange,
// app/schemas/runs.py). Exported for that second file to reuse.
export function ChangedFieldsTable({ changedFields }: { changedFields: FieldChange[] }) {
  if (changedFields.length === 0) {
    return null
  }
  return (
    <table className="mt-2 w-full border-collapse text-xs">
      <tbody>
        {changedFields.map((change) => (
          <tr key={change.field}>
            <td className="py-0.5 pr-2 text-slate-500">{change.field}</td>
            <td className="py-0.5 pr-2 font-mono text-slate-500 line-through">
              {formatPreviewValue(change.base_value)}
            </td>
            <td className="py-0.5 font-mono text-slate-200">{formatPreviewValue(change.override_value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface ResolvedStandardCardProps {
  resolved: ResolvedStandardPreview
  standardsById: Map<number, StandardSummary>
}

// What resolve_standard would actually insert (or reuse) for one base
// standard plus the submit's protocol overrides -- one card per
// selected standard, independent of which checkpoints are selected.
function ResolvedStandardCard({ resolved, standardsById }: ResolvedStandardCardProps) {
  const baseStandard = standardsById.get(resolved.base_standard_id)
  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-200">{baseStandard?.label ?? resolved.base_standard_id}</span>
        <span className="font-mono text-xs text-slate-500">→ {resolved.hash}</span>
        <span
          className={
            resolved.is_new_standard
              ? 'rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-300'
              : 'rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400'
          }
        >
          {resolved.is_new_standard ? 'new standard, no label' : 'reuses existing standard'}
        </span>
      </div>
      <ChangedFieldsTable changedFields={resolved.changed_fields} />
    </div>
  )
}

// Everything Submit needs to show before anything POSTs: how many runs
// and GPUs (Trap T1 -- GPUs are per distinct checkpoint, not per run,
// so this is the one number a human will actually act on), which
// findings block or merely warn and why, and what each selected
// standard and each resolved sampling profile would actually resolve
// to. All of it comes straight from POST /runs/preview
// (backend/app/services/runs/preview.py) -- this component never
// recomputes any of it, so Submit and the Standards page can never
// disagree about what a value does.
export function DryRunPreview({
  preview,
  isLoading,
  isError,
  error,
  standardsById,
  checkpointsById,
  samplingProfilesById,
  userSamplingOverrides,
}: DryRunPreviewProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Checking…</p>
  }

  if (isError) {
    return <p className="text-sm text-red-400">Could not load preview: {String(error)}</p>
  }

  if (!preview) {
    return <p className="text-sm text-slate-500">Select at least one checkpoint and one standard.</p>
  }

  const groupedErrors = groupFindingsByCode(preview.pairs, 'errors')
  const groupedWarnings = groupFindingsByCode(preview.pairs, 'warnings')
  const comparisonHashes = comparisonHashByPair(preview.pairs)

  return (
    <div>
      <p className="text-sm text-slate-200">
        <span className="font-medium">{preview.run_count}</span> run{preview.run_count === 1 ? '' : 's'}{' '}
        across <span className="font-medium">{preview.gpu_count}</span> GPU
        {preview.gpu_count === 1 ? '' : 's'}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        GPUs are counted per distinct checkpoint -- standards against one checkpoint share one server.
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
        <h3 className="text-xs font-medium text-slate-400">Resolved standards</h3>
        {preview.resolved_standards.map((resolved) => (
          <ResolvedStandardCard
            key={resolved.base_standard_id}
            resolved={resolved}
            standardsById={standardsById}
          />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <h3 className="text-xs font-medium text-slate-400">Resolved sampling</h3>
        {preview.resolved_sampling.map((resolved) => (
          <ResolvedSamplingCard
            key={`${resolved.checkpoint_id}-${resolved.standard_id}`}
            resolved={resolved}
            standardsById={standardsById}
            checkpointsById={checkpointsById}
            samplingProfilesById={samplingProfilesById}
            userSamplingOverrides={userSamplingOverrides}
            comparisonHash={comparisonHashes.get(`${resolved.checkpoint_id}-${resolved.standard_id}`)}
          />
        ))}
      </div>
    </div>
  )
}
