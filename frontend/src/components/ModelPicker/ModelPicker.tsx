import { useState } from 'react'
import type { CheckpointListItem } from '../../api/client'
import { AvailabilityBadge } from '../AvailabilityBadge/AvailabilityBadge'
import { Checkbox } from '../Checkbox/Checkbox'
import { ModelName } from '../ModelName/ModelName'
import { SearchInput } from '../SearchInput/SearchInput'
import { groupCheckpointsByFamily } from '../../utils/familyGroups'
import { toggleId } from '../../utils/toggleId'
import { filterCheckpointsByQuery } from './ModelPicker.helper'

interface ModelPickerProps {
  checkpoints: CheckpointListItem[]
  selectedCheckpointIds: number[]
  onSelectedCheckpointIdsChange: (ids: number[]) => void
}

// The Choose step's model list: searchable, grouped by family, weights
// status on every row. Assumes `checkpoints` is non-empty --
// NewEvaluationPage shows its own full-page empty state ("Register a
// model first") before ever mounting this, so the only empty case here
// is "no results for this search".
export function ModelPicker({ checkpoints, selectedCheckpointIds, onSelectedCheckpointIdsChange }: ModelPickerProps) {
  const [query, setQuery] = useState('')
  const groups = groupCheckpointsByFamily(filterCheckpointsByQuery(checkpoints, query))

  return (
    <div>
      <SearchInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery('')}
        placeholder="Search models..."
        aria-label="Search models"
      />
      <div className="mt-3 max-h-96 space-y-4 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No models match &quot;{query}&quot;.</p>
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
                      <Checkbox
                        checked={selectedCheckpointIds.includes(checkpoint.id)}
                        onChange={() =>
                          onSelectedCheckpointIdsChange(toggleId(selectedCheckpointIds, checkpoint.id))
                        }
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
