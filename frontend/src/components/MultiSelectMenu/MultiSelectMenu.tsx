import type { ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../utils/cn'
import { MENU_CONTENT_CLASS_NAME, MENU_GROUP_LABEL_CLASS_NAME, MENU_ITEM_CLASS_NAME, MENU_SEPARATOR_CLASS_NAME } from '../Menu/Menu.helper'
import { selectTriggerClassName } from '../SelectField/SelectField.helper'
import { countSuffix, toggleMultiSelectValue } from './MultiSelectMenu.helper'

export interface MultiSelectOption {
  value: string
  label: ReactNode
}

export interface MultiSelectGroup {
  // Omitted for a menu with only one group (nothing to head it with) --
  // the Leaderboard's own Family and Benchmarks filters both group by
  // something (a normalised family, a benchmark's category), so this
  // stays a required part of the shape rather than a flat option list
  // with grouping bolted on separately.
  heading?: string
  options: MultiSelectOption[]
}

interface MultiSelectMenuProps {
  // The trigger's own text ("Family", "Benchmarks") -- the component
  // builds the whole trigger itself (this label, the " (N)" count and
  // the chevron) using the same selectTriggerClassName SelectField
  // does, rather than taking a caller-supplied trigger, so every
  // dropdown trigger in the app reads as one control regardless of
  // whether a Select or a checklist opens underneath it.
  label: string
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
export function MultiSelectMenu({ label, groups, selected, onChange, align = 'start' }: MultiSelectMenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button type="button" className={selectTriggerClassName()}>
          <span className="truncate">
            {label}
            {countSuffix(selected.length)}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={6}
          className={cn(MENU_CONTENT_CLASS_NAME, 'max-h-80 min-w-48 overflow-y-auto')}
        >
          {groups.map((group, groupIndex) => (
            <DropdownMenuPrimitive.Group key={group.heading ?? groupIndex}>
              {groupIndex > 0 && <DropdownMenuPrimitive.Separator className={MENU_SEPARATOR_CLASS_NAME} />}
              {group.heading && (
                <DropdownMenuPrimitive.Label className={MENU_GROUP_LABEL_CLASS_NAME}>
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
                    className={cn(MENU_ITEM_CLASS_NAME, 'flex items-center gap-2 text-foreground')}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                        checked ? 'border-primary bg-primary' : 'border-border bg-muted',
                      )}
                    >
                      {checked && <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />}
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
