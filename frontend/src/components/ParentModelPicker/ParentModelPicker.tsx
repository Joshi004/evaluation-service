import { useState } from 'react'
import type { CheckpointListItem } from '../../api/client'
import { groupCheckpointsByFamily } from '../../utils/familyGroups'
// Reused as-is from ModelPicker -- the same "name or family substring"
// filter applies to either a multi-select or, here, a single-select
// list, and duplicating it would risk the two silently drifting apart.
import { filterCheckpointsByQuery } from '../ModelPicker/ModelPicker.helper'
import { AvailabilityBadge } from '../AvailabilityBadge/AvailabilityBadge'
import { ModelName } from '../ModelName/ModelName'
import { SearchInput } from '../SearchInput/SearchInput'

interface ParentModelPickerProps {
  checkpoints: CheckpointListItem[]
  selectedParentId: number | null
  onSelectedParentIdChange: (parentId: number | null) => void
}

const RADIO_GROUP_NAME = 'parent-model-picker'

// Registration step 3's own lineage picker (docs/UI_REDESIGN_PLAN.md
// §8.11): a single-select mirror of ModelPicker's own searchable,
// family-grouped list, with "None / unknown" first and selected by
// default -- most registrations have no known parent, so that option
// should never require scrolling past a list of models to reach.
export function ParentModelPicker({ checkpoints, selectedParentId, onSelectedParentIdChange }: ParentModelPickerProps) {
  const [query, setQuery] = useState('')
  const groups = groupCheckpointsByFamily(filterCheckpointsByQuery(checkpoints, query))

  return (
    <div>
      <SearchInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery('')}
        placeholder="Search models…"
      />
      <div className="mt-3 max-h-72 space-y-4 overflow-y-auto">
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
          <input
            type="radio"
            name={RADIO_GROUP_NAME}
            className="mt-0.5"
            checked={selectedParentId === null}
            onChange={() => onSelectedParentIdChange(null)}
          />
          <span className="text-sm text-foreground">None / unknown</span>
        </label>

        {groups.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">No models match &quot;{query}&quot;.</p>
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              <h3 className="text-xs font-medium text-muted-foreground">
                {group.label} ({group.checkpoints.length})
              </h3>
              <ul className="mt-1 space-y-0.5">
                {group.checkpoints.map((checkpoint) => (
                  <li key={checkpoint.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                      <input
                        type="radio"
                        name={RADIO_GROUP_NAME}
                        className="mt-0.5"
                        checked={selectedParentId === checkpoint.id}
                        onChange={() => onSelectedParentIdChange(checkpoint.id)}
                      />
                      <ModelName name={checkpoint.name} />
                      <AvailabilityBadge status={checkpoint.availability_status} />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
