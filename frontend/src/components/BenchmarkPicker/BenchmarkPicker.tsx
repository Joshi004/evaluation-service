import type { StandardSummary } from '../../api/client'
import { Badge } from '../Badge/Badge'
import { Checkbox } from '../Checkbox/Checkbox'
import { benchmarkVersion } from '../../utils/benchmarkDisplayName'
import { cn } from '../../utils/cn'
import { protocolSummary } from '../../utils/protocolSummary'
import { groupStandardsByCategory } from '../../utils/standardCategoryGroups'
import { toggleId } from '../../utils/toggleId'

interface BenchmarkPickerProps {
  standards: StandardSummary[]
  selectedStandardIds: number[]
  onSelectedStandardIdsChange: (ids: number[]) => void
}

// The Choose step's benchmark list (Phase 10, docs/UI_REDESIGN_PLAN.md
// §8.10): selectable cards grouped by category, each with a version
// badge, its published description and its protocol summary -- reading
// the recommended settings doesn't need opening Customize protocol at
// all. Assumes `standards` is non-empty (NewEvaluationPage's own
// full-page states cover "no benchmarks in the catalog").
export function BenchmarkPicker({ standards, selectedStandardIds, onSelectedStandardIdsChange }: BenchmarkPickerProps) {
  const groups = groupStandardsByCategory(standards)

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.category ?? 'uncategorised'}>
          <h3 className="text-xs font-medium text-muted-foreground">{group.category ?? 'Other'}</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.standards.map((standard) => {
              const isSelected = selectedStandardIds.includes(standard.id)
              const version = benchmarkVersion(standard.label)
              return (
                <label
                  key={standard.id}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-lg border p-3',
                    isSelected ? 'border-primary bg-primary-soft' : 'border-border bg-card hover:border-border-strong',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onSelectedStandardIdsChange(toggleId(selectedStandardIds, standard.id))}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {standard.display_name ?? standard.benchmark}
                    </span>
                    {version && <Badge tone="neutral">{version}</Badge>}
                  </div>
                  {standard.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{standard.description}</p>
                  )}
                  <p className="text-xs text-subtle-foreground">{protocolSummary(standard)}</p>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
