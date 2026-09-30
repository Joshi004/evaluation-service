import { cn } from '../../utils/cn'

interface TextInputClassNameOptions {
  invalid?: boolean
  paddingClassName?: string
  className?: string
}

// Shared by TextInput and SearchInput so a leading icon or trailing
// clear button can ask for different horizontal padding without a
// second, conflicting padding utility landing in the same class
// string (no tailwind-merge in this project).
export function textInputClassName({
  invalid = false,
  paddingClassName = 'px-3',
  className,
}: TextInputClassNameOptions): string {
  return cn(
    'h-9 w-full rounded-md border bg-muted text-sm text-foreground placeholder:text-subtle-foreground',
    'disabled:cursor-not-allowed disabled:opacity-50',
    invalid ? 'border-danger' : 'border-border',
    paddingClassName,
    className,
  )
}
