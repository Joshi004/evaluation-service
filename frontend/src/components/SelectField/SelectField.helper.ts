import { cn } from '../../utils/cn'

export interface SelectOption {
  value: string
  label: string
  // Shown in the list only, next to the label -- a setup's own model
  // count, a partition's queue depth. Never portalled into the
  // trigger: Radix's own Select.Value only ever mirrors an Item's
  // Select.ItemText, and the hint deliberately sits outside that, so
  // the trigger stays exactly as wide as the label alone.
  hint?: string
  disabled?: boolean
}

export interface SelectOptionGroup {
  // Omitted for a field with only one group -- StartModelServerDialog's
  // own family groups are the one caller with more than one.
  heading?: string
  options: SelectOption[]
}

export type SelectFieldSize = 'sm' | 'md'

interface SelectTriggerClassNameOptions {
  size?: SelectFieldSize
  invalid?: boolean
  className?: string
}

const TRIGGER_SIZE_CLASSES: Record<SelectFieldSize, string> = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-9 px-3 text-sm',
}

// Shared by SelectField and MultiSelectMenu so a filter row's dropdown
// triggers all read as one control, regardless of whether the popover
// underneath is Select or DropdownMenu. `className` is left to the
// caller to add sizing like `w-full` or `w-40` -- SelectField's own
// wrapper wants the former, MultiSelectMenu's inline trigger wants
// neither, and with no tailwind-merge in this project a width baked
// in here would conflict with either.
export function selectTriggerClassName({ size = 'md', invalid = false, className }: SelectTriggerClassNameOptions = {}): string {
  return cn(
    'inline-flex items-center justify-between gap-2 rounded-md border bg-muted text-foreground',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[placeholder]:text-subtle-foreground',
    invalid ? 'border-danger' : 'border-border',
    TRIGGER_SIZE_CLASSES[size],
    className,
  )
}

// Radix reserves an item value of '' to mean "nothing selected, show
// the placeholder" -- every Select.Item must have a non-empty value.
// Several callers use '' for a real, always-selectable option instead
// (PartitionPicker's "Default", RunsToolbar's "All models", a
// profile's own "Default (...)" row), so that one option is swapped
// for this sentinel on the way into Radix and swapped back the moment
// a caller's onValueChange fires -- every call site keeps its existing
// `value === '' ? null : ...` logic untouched.
const EMPTY_OPTION_SENTINEL = '__select-field-empty-option__'

function hasEmptyOption(groups: SelectOptionGroup[]): boolean {
  return groups.some((group) => group.options.some((option) => option.value === ''))
}

export function toItemValue(value: string): string {
  return value === '' ? EMPTY_OPTION_SENTINEL : value
}

export function fromItemValue(itemValue: string): string {
  return itemValue === EMPTY_OPTION_SENTINEL ? '' : itemValue
}

// The value Select.Root itself needs: unchanged unless it's '' *and*
// one of the groups actually has an option for '' -- then it's
// remapped the same way toItemValue remaps that option, so Radix
// resolves the trigger to that item's own rendered label instead of
// falling back to the placeholder. A caller with no '' option (a
// placeholder-style "Select a model…") keeps seeing the placeholder,
// exactly as today.
export function resolveSelectRootValue(value: string, groups: SelectOptionGroup[]): string {
  if (value !== '') return value
  return hasEmptyOption(groups) ? EMPTY_OPTION_SENTINEL : ''
}
