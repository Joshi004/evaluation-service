import type { ChangeEvent } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type {
  FilterOptionGroup,
  LeaderboardDensity,
  LeaderboardLens,
  LeaderboardSetupsMode,
  ResolvedLeaderboardView,
} from '../../pages/LeaderboardPage.helper'
import type { FamilyOption } from '../../utils/buildLeaderboard'
import { Button } from '../Button/Button'
import { Checkbox } from '../Checkbox/Checkbox'
import { IconButton } from '../IconButton/IconButton'
import { MultiSelectMenu } from '../MultiSelectMenu/MultiSelectMenu'
import { Popover } from '../Popover/Popover'
import { SearchInput } from '../SearchInput/SearchInput'
import { SegmentedControl } from '../SegmentedControl/SegmentedControl'

interface LeaderboardToolbarProps {
  view: ResolvedLeaderboardView
  familyOptions: FamilyOption[]
  benchmarkFilterGroups: FilterOptionGroup[]
  onQueryChange: (q: string) => void
  onFamilyChange: (keys: string[]) => void
  onBenchChange: (benchmarks: string[]) => void
  onModeChange: (mode: LeaderboardSetupsMode) => void
  onLensChange: (lens: LeaderboardLens) => void
  onDensityChange: (density: LeaderboardDensity) => void
  onHeatToggle: (enabled: boolean) => void
}

const LENS_OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'benchmark', label: 'By benchmark' },
]
const MODE_OPTIONS = [
  { value: 'like', label: 'Like-for-like' },
  { value: 'all', label: 'All setups' },
]
const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
]

function countSuffix(count: number): string {
  return count > 0 ? ` (${count})` : ''
}

// §8.6 item 2's toolbar. Controls that don't apply to the current lens
// are hidden rather than disabled (Benchmarks, Setups mode and heat
// tint are Overview-only -- this phase's own plan) so the row still
// fits on one line at 1024px; density and heat share one "Display"
// popover for the same reason.
export function LeaderboardToolbar({
  view,
  familyOptions,
  benchmarkFilterGroups,
  onQueryChange,
  onFamilyChange,
  onBenchChange,
  onModeChange,
  onLensChange,
  onDensityChange,
  onHeatToggle,
}: LeaderboardToolbarProps) {
  return (
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

      {view.lens === 'overview' && (
        <>
          <MultiSelectMenu
            trigger={
              <Button variant="secondary" size="sm">
                Benchmarks{countSuffix(view.benchFilter.length)}
              </Button>
            }
            groups={benchmarkFilterGroups}
            selected={view.benchFilter}
            onChange={onBenchChange}
          />
          <SegmentedControl value={view.mode} onValueChange={(value) => onModeChange(value as LeaderboardSetupsMode)} options={MODE_OPTIONS} />
        </>
      )}

      <SegmentedControl value={view.lens} onValueChange={(value) => onLensChange(value as LeaderboardLens)} options={LENS_OPTIONS} />

      <Popover
        align="end"
        trigger={
          <IconButton aria-label="Display settings" variant="secondary">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        }
      >
        <div className="w-48 space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Density</p>
            <SegmentedControl
              value={view.density}
              onValueChange={(value) => onDensityChange(value as LeaderboardDensity)}
              options={DENSITY_OPTIONS}
            />
          </div>
          {view.lens === 'overview' && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={view.heatEnabled} onChange={(event) => onHeatToggle(event.target.checked)} />
              Heat tint
            </label>
          )}
        </div>
      </Popover>
    </div>
  )
}
