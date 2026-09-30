import type { ReactNode } from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '../../utils/cn'

interface SegmentedControlOption {
  value: string
  // ReactNode, not just string -- the Runs page's own status segments
  // each carry a muted count alongside their label ("Done 8"), not
  // plain text.
  label: ReactNode
}

interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  // Required -- none of this control's callers pair it with a visible
  // <label>, so without this every segmented control would have no
  // accessible name of its own.
  'aria-label': string
}

// A row of mutually-exclusive options rendered as one bordered strip
// (density toggles, lens switches) -- an alternative to SelectField
// when there are only a few, always-visible choices.
export function SegmentedControl({ options, value, onValueChange, className, 'aria-label': ariaLabel }: SegmentedControlProps) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      aria-label={ariaLabel}
      value={value}
      // Radix allows deselecting a single-select group by default; a
      // segmented control should always have exactly one option on,
      // so an empty next value (re-clicking the active one) is ignored.
      onValueChange={(next) => {
        if (next) onValueChange(next)
      }}
      className={cn('inline-flex h-9 rounded-md border border-border p-0.5', className)}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className={cn(
            // No explicit height -- the root's own flex default
            // (align-items: stretch) already fills the row, the same
            // 36px every other toolbar control now stands, with the
            // root's own p-0.5 as the only difference from a
            // SelectField's own trigger height.
            'flex items-center justify-center rounded-sm px-2.5 text-xs font-medium text-muted-foreground',
            'data-[state=on]:bg-muted data-[state=on]:text-foreground',
          )}
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}
