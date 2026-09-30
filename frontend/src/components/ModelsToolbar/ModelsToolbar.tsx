import type { ChangeEvent } from 'react'
import type { ModelsViewMode, ModelsWeightsFilter, ResolvedModelsView } from '../../pages/ModelsPage.helper'
import type { FamilyOption } from '../../utils/buildLeaderboard'
import { WEIGHTS_STATUS_LABELS } from '../../utils/labels'
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

const WEIGHTS_OPTIONS = [
  { value: 'all', label: 'All weights' },
  { value: 'available', label: WEIGHTS_STATUS_LABELS.available },
  { value: 'unavailable', label: WEIGHTS_STATUS_LABELS.unavailable },
  { value: 'incomplete', label: WEIGHTS_STATUS_LABELS.incomplete },
  { value: 'unknown', label: WEIGHTS_STATUS_LABELS.unknown },
]

// This toolbar: search, the family filter (options and labels from
// familyGroups.ts, so this can never disagree with the section
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
          label="Family"
          groups={[{ options: familyOptions.map((option) => ({ value: option.key, label: option.label })) }]}
          selected={view.familyFilter}
          onChange={onFamilyChange}
        />

        <SelectField
          value={view.weights}
          onValueChange={(value) => onWeightsChange(value as ModelsWeightsFilter)}
          groups={[{ options: WEIGHTS_OPTIONS }]}
          aria-label="Weights"
          className="w-44"
        />
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
