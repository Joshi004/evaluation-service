import type { CheckpointListItem, StandardSummary } from '../../api/client'
import { AvailabilityBadge } from '../AvailabilityBadge/AvailabilityBadge'
import { toggleId } from './SubmitGrid.helper'

interface SubmitGridProps {
  checkpoints: CheckpointListItem[]
  standards: StandardSummary[]
  selectedCheckpointIds: number[]
  selectedStandardIds: number[]
  onCheckpointIdsChange: (ids: number[]) => void
  onStandardIdsChange: (ids: number[]) => void
}

// The two independent multi-selects that together define a submit's
// grid. There is no per-cell selection: POST /runs always takes the
// full cartesian product of checkpoint_ids x standard_ids
// (app/schemas/runs.py's CreateRunsRequest) -- one checkpoint against
// six standards, or three checkpoints against two, never a sparse
// subset of cells.
export function SubmitGrid({
  checkpoints,
  standards,
  selectedCheckpointIds,
  selectedStandardIds,
  onCheckpointIdsChange,
  onStandardIdsChange,
}: SubmitGridProps) {
  const runCount = selectedCheckpointIds.length * selectedStandardIds.length

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-slate-300">Checkpoints</h3>
          <ul className="mt-2 space-y-1">
            {checkpoints.map((checkpoint) => (
              <li key={checkpoint.id}>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedCheckpointIds.includes(checkpoint.id)}
                    onChange={() =>
                      onCheckpointIdsChange(toggleId(selectedCheckpointIds, checkpoint.id))
                    }
                  />
                  {checkpoint.name}
                  {/* Selectable either way (Phase 8 item 5): the backend's
                   * checkpoint_unavailable error explains itself in the dry
                   * run preview below, which teaches more than a disabled
                   * checkbox the user can't click and can't ask why. */}
                  {checkpoint.availability_status !== 'available' && (
                    <AvailabilityBadge status={checkpoint.availability_status} />
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-300">Standards</h3>
          <ul className="mt-2 space-y-1">
            {standards.map((standard) => (
              <li key={standard.id}>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedStandardIds.includes(standard.id)}
                    onChange={() => onStandardIdsChange(toggleId(selectedStandardIds, standard.id))}
                  />
                  {standard.label}
                  <span className="text-xs text-slate-500">({standard.benchmark})</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {selectedCheckpointIds.length} checkpoint{selectedCheckpointIds.length === 1 ? '' : 's'} ×{' '}
        {selectedStandardIds.length} standard{selectedStandardIds.length === 1 ? '' : 's'} = {runCount}{' '}
        run{runCount === 1 ? '' : 's'}
      </p>
    </div>
  )
}
