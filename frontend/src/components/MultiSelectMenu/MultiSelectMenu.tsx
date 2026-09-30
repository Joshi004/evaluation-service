import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../utils/cn'
import { toggleMultiSelectValue } from './MultiSelectMenu.helper'

export interface MultiSelectOption {
  value: string
  label: ReactNode
}

export interface MultiSelectGroup {
  // Omitted for a menu with only one group (nothing to head it with) --
  // the Leaderboard's own Family and Benchmarks filters (§8.6 item 2)
  // both group by something (a normalised family, a benchmark's
  // category), so this stays a required part of the shape rather than
  // a flat option list with grouping bolted on separately.
  heading?: string
  options: MultiSelectOption[]
}

interface MultiSelectMenuProps {
  trigger: ReactNode
  groups: MultiSelectGroup[]
  selected: string[]
  onChange: (next: string[]) => void
  align?: 'start' | 'center' | 'end'
}

// A checklist inside a dropdown -- Radix closes a menu on every
// selection by default, which would make picking three benchmarks take
// three re-opens; each CheckboxItem's onSelect below cancels that so
// the menu stays open until the trigger is clicked again or Escape is
// pressed.
export function MultiSelectMenu({ trigger, groups, selected, onChange, align = 'start' }: MultiSelectMenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={6}
          className="z-50 max-h-80 min-w-48 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {groups.map((group, groupIndex) => (
            <DropdownMenuPrimitive.Group key={group.heading ?? groupIndex}>
              {groupIndex > 0 && <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />}
              {group.heading && (
                <DropdownMenuPrimitive.Label className="px-2.5 py-1.5 text-xs font-semibold text-subtle-foreground uppercase">
                  {group.heading}
                </DropdownMenuPrimitive.Label>
              )}
              {group.options.map((option) => {
                const checked = selected.includes(option.value)
                return (
                  <DropdownMenuPrimitive.CheckboxItem
                    key={option.value}
                    checked={checked}
                    onCheckedChange={() => onChange(toggleMultiSelectValue(selected, option.value))}
                    onSelect={(event) => event.preventDefault()}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground',
                      // No plain outline-none -- Menu.tsx's own Item has the
                      // full reasoning for why that would break this same
                      // focus-visible outline instead of just hiding it at rest.
                      'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                      'data-[highlighted]:bg-muted',
                    )}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border">
                      {checked && <Check className="h-3 w-3 text-primary" aria-hidden="true" />}
                    </span>
                    {option.label}
                  </DropdownMenuPrimitive.CheckboxItem>
                )
              })}
            </DropdownMenuPrimitive.Group>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
