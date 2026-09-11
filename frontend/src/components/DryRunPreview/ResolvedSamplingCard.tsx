import type {
  CheckpointListItem,
  ResolvedSamplingPreview,
  SamplingOverrides,
  SamplingProfileSummary,
  StandardSummary,
} from '../../api/client'
import { samplingProfileDisplayName } from '../../utils/samplingProfileDisplayName'
import { ChangedFieldsTable } from './DryRunPreview'
import { formatSamplingOverrides } from './DryRunPreview.helper'

interface ResolvedSamplingCardProps {
  resolved: ResolvedSamplingPreview
  standardsById: Map<number, StandardSummary>
  checkpointsById: Map<number, CheckpointListItem>
  samplingProfilesById: Map<number, SamplingProfileSummary>
  userSamplingOverrides: SamplingOverrides
  // undefined only if the backend ever returns a resolved-sampling
  // entry with no matching pair, which preview.py's own loop structure
  // (one pair per (checkpoint, standard), same loop that appends both)
  // never does -- kept optional rather than asserted so a lookup miss
  // shows as "--" instead of throwing.
  comparisonHash: string | undefined
}

// What resolve_sampling_profile would actually insert (or reuse) for
// one (checkpoint, standard) pair -- one card per pair, since S-D4's
// merge depends on both the checkpoint's own default sampling profile
// and the standard's sampling_overrides, so the same submit-level
// override can resolve to a different profile for every cell of the
// grid. Shows all three merge layers (base, standard-mandated,
// user-changed) plus the comparison_hash they produce, so the number
// that decides leaderboard grouping is visible before the run, not only
// discovered on the leaderboard afterwards (Phase 8, S-D36).
export function ResolvedSamplingCard({
  resolved,
  standardsById,
  checkpointsById,
  samplingProfilesById,
  userSamplingOverrides,
  comparisonHash,
}: ResolvedSamplingCardProps) {
  const checkpoint = checkpointsById.get(resolved.checkpoint_id)
  const standard = standardsById.get(resolved.standard_id)
  const baseSamplingProfile = samplingProfilesById.get(resolved.base_sampling_profile_id)

  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-200">
          {checkpoint?.name ?? resolved.checkpoint_id} × {standard?.label ?? resolved.standard_id}
        </span>
        <span className="font-mono text-xs text-slate-500">→ {resolved.hash}</span>
        <span
          className={
            resolved.is_new_sampling_profile
              ? 'rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-300'
              : 'rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400'
          }
        >
          {resolved.is_new_sampling_profile ? 'new sampling profile, no label' : 'reuses existing sampling profile'}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Started from</dt>
          <dd className="text-slate-300">
            {baseSamplingProfile
              ? samplingProfileDisplayName(baseSamplingProfile.label, baseSamplingProfile.hash)
              : `#${resolved.base_sampling_profile_id}`}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Comparison hash</dt>
          <dd className="font-mono text-slate-300">{comparisonHash ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Standard mandates</dt>
          <dd className="text-slate-300">{formatSamplingOverrides(standard?.sampling_overrides ?? {})}</dd>
        </div>
        <div>
          <dt className="text-slate-500">You changed</dt>
          <dd className="text-slate-300">{formatSamplingOverrides({ ...userSamplingOverrides })}</dd>
        </div>
      </dl>

      <ChangedFieldsTable changedFields={resolved.changed_fields} />
      {resolved.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {resolved.warnings.map((warning) => (
            <li key={warning.field} className="text-xs text-amber-400">
              {warning.field}: {warning.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
