import { X } from 'lucide-react'
import { IconButton } from '../IconButton/IconButton'

interface FilterChipProps {
  label: string
  value: string
  onClear: () => void
  clearLabel: string
}

// One active, removable filter -- a toolbar's own "Batch: X" or
// "Rule: Y" pill. Previously hand-styled once per caller at two
// different heights and typographies (RunsToolbar's own batch chip,
// SampleFilters' own rule chip); this is the one shape both share now,
// at the same 36px every other toolbar control stands.
export function FilterChip({ label, value, onClear, clearLabel }: FilterChipProps) {
  return (
    <span className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground">{value}</span>
      <IconButton variant="ghost" size="sm" aria-label={clearLabel} onClick={onClear}>
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </IconButton>
    </span>
  )
}
