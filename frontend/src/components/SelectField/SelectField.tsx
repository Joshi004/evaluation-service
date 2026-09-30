import { Check, ChevronDown } from 'lucide-react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { cn } from '../../utils/cn'
import { MENU_CONTENT_CLASS_NAME, MENU_GROUP_LABEL_CLASS_NAME, MENU_ITEM_CLASS_NAME, MENU_SEPARATOR_CLASS_NAME } from '../Menu/Menu.helper'
import {
  fromItemValue,
  resolveSelectRootValue,
  selectTriggerClassName,
  toItemValue,
  type SelectFieldSize,
  type SelectOptionGroup,
} from './SelectField.helper'

interface SelectFieldProps {
  value: string
  onValueChange: (value: string) => void
  groups: SelectOptionGroup[]
  // Shown only while `value` resolves to no option -- see
  // SelectField.helper.ts's own resolveSelectRootValue for why a
  // caller with a real "Default"/"All ..." option for '' never falls
  // into this case.
  placeholder?: string
  size?: SelectFieldSize
  invalid?: boolean
  disabled?: boolean
  id?: string
  // No default width -- the trigger is `inline-flex` and hugs its
  // content (the table header's own compact setup picker wants exactly
  // that) unless a caller adds one, `w-full` included. Two width
  // utilities can't safely share one class string with no
  // tailwind-merge in this project, so this can't default to `w-full`
  // itself and still let a `w-56`-style caller override it.
  className?: string
  'aria-label'?: string
}

// A styled Radix Select, not a native <select> -- every dropdown in
// the app (Menu, MultiSelectMenu, ThemeMenu, this) now opens the same
// in-app popover instead of each platform's own picker UI.
export function SelectField({
  value,
  onValueChange,
  groups,
  placeholder,
  size = 'md',
  invalid = false,
  disabled = false,
  id,
  className,
  'aria-label': ariaLabel,
}: SelectFieldProps) {
  return (
    <SelectPrimitive.Root
      value={resolveSelectRootValue(value, groups)}
      onValueChange={(itemValue) => onValueChange(fromItemValue(itemValue))}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        className={cn(selectTriggerClassName({ size, invalid }), className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={cn(MENU_CONTENT_CLASS_NAME, 'min-w-[var(--radix-select-trigger-width)]')}
        >
          <SelectPrimitive.Viewport className="max-h-80 overflow-y-auto">
            {groups.map((group, groupIndex) => (
              <SelectPrimitive.Group key={group.heading ?? groupIndex}>
                {groupIndex > 0 && <SelectPrimitive.Separator className={MENU_SEPARATOR_CLASS_NAME} />}
                {group.heading && (
                  <SelectPrimitive.Label className={MENU_GROUP_LABEL_CLASS_NAME}>{group.heading}</SelectPrimitive.Label>
                )}
                {group.options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={toItemValue(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      MENU_ITEM_CLASS_NAME,
                      'flex items-center justify-between gap-4',
                      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                      {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
                    </span>
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Group>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
