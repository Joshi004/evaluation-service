import type { CheckpointListItem, ResolvedServingPreview, ServingProfileSummary } from '../../api/client'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'
import { ChangedFieldsTable } from './DryRunPreview'

interface ResolvedServingCardProps {
  resolved: ResolvedServingPreview
  checkpointsById: Map<number, CheckpointListItem>
  servingProfilesById: Map<number, ServingProfileSummary>
}

// What resolve_serving_profile would actually insert (or reuse) for one
// checkpoint's serving override -- one card per selected checkpoint,
// mirroring ResolvedSamplingCard.tsx's own per-pair card one axis over,
// but simpler: nothing about a standard feeds into serving (no
// standard-mandate layer, so no "standard mandates" / "you changed"
// split to show -- ChangedFieldsTable below already is the complete
// story), and there is one resolved profile per checkpoint rather than
// per (checkpoint, standard) pair.
export function ResolvedServingCard({
  resolved,
  checkpointsById,
  servingProfilesById,
}: ResolvedServingCardProps) {
  const checkpoint = checkpointsById.get(resolved.checkpoint_id)
  const baseServingProfile = servingProfilesById.get(resolved.base_serving_profile_id)

  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-200">{checkpoint?.name ?? resolved.checkpoint_id}</span>
        <span className="font-mono text-xs text-slate-500">→ {resolved.hash}</span>
        <span
          className={
            resolved.is_new_serving_profile
              ? 'rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-300'
              : 'rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400'
          }
        >
          {resolved.is_new_serving_profile ? 'new serving profile, no label' : 'reuses existing serving profile'}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Started from</dt>
          <dd className="text-slate-300">
            {baseServingProfile
              ? servingProfileDisplayName(baseServingProfile.label, baseServingProfile.hash)
              : `#${resolved.base_serving_profile_id}`}
          </dd>
        </div>
        <div>
          {/* Called out on its own, not left to ChangedFieldsTable alone
              -- this is the number RunPreview.gpu_count is actually
              summed over (preview.py), so a changed gpus needs to be
              visible even when this card's other fields are untouched. */}
          <dt className="text-slate-500">GPUs</dt>
          <dd className="text-slate-300">{resolved.gpus}</dd>
        </div>
      </dl>

      <ChangedFieldsTable changedFields={resolved.changed_fields} />
    </div>
  )
}
