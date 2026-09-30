import type { ChangeEvent } from 'react'
import type { ModelsViewMode, ModelsWeightsFilter, ResolvedModelsView } from '../../pages/ModelsPage.helper'
import type { FamilyOption } from '../../utils/buildLeaderboard'
import { WEIGHTS_STATUS_LABELS } from '../../utils/labels'
import { Button } from '../Button/Button'
import { MultiSelectMenu } from '../MultiSelectMenu/MultiSelectMenu'
import { SearchInput } from '../SearchInput/SearchInput'
import { SegmentedControl } from '../SegmentedControl/SegmentedControl'
import { SelectField } from '../SelectField/SelectField'

interface ModelsToolbarProps {
  view: ResolvedModelsView
  familyOptions: FamilyOption[]
  onQueryChange: (q: string) => void
  onFamilyChange: (keys: string[]) => void
  onWeightsChange: (weights: ModelsWeightsFilter) => void
  onViewModeChange: (view: ModelsViewMode) => void
}

const VIEW_MODE_OPTIONS = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Table' },
]

function countSuffix(count: number): string {
  return count > 0 ? ` (${count})` : ''
}

// §8.11's own toolbar: search, the family filter (options and labels
// from familyGroups.ts, so this can never disagree with the section
// headings below it), a weights filter and the cards/table toggle.
export function ModelsToolbar({
  view,
  familyOptions,
  onQueryChange,
  onFamilyChange,
  onWeightsChange,
  onViewModeChange,
}: ModelsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={view.q}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
          onClear={() => onQueryChange('')}
          placeholder="Search models..."
          className="w-56"
          aria-label="Search models"
        />

        <MultiSelectMenu
          trigger={
            <Button variant="secondary" size="sm">
              Family{countSuffix(view.familyFilter.length)}
            </Button>
          }
          groups={[{ options: familyOptions.map((option) => ({ value: option.key, label: option.label })) }]}
          selected={view.familyFilter}
          onChange={onFamilyChange}
        />

        <SelectField
          value={view.weights}
          onChange={(event) => onWeightsChange(event.target.value as ModelsWeightsFilter)}
          aria-label="Weights"
          className="w-44"
        >
          <option value="all">All weights</option>
          <option value="available">{WEIGHTS_STATUS_LABELS.available}</option>
          <option value="unavailable">{WEIGHTS_STATUS_LABELS.unavailable}</option>
          <option value="incomplete">{WEIGHTS_STATUS_LABELS.incomplete}</option>
          <option value="unknown">{WEIGHTS_STATUS_LABELS.unknown}</option>
        </SelectField>
      </div>

      <SegmentedControl
        value={view.view}
        onValueChange={(value) => onViewModeChange(value as ModelsViewMode)}
        options={VIEW_MODE_OPTIONS}
        aria-label="View"
      />
    </div>
  )
}
