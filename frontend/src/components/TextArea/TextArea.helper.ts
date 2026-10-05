import { cn } from '../../utils/cn'

interface TextAreaClassNameOptions {
  invalid?: boolean
  className?: string
}

// Mirrors TextInput.helper.ts's own textInputClassName, minus the
// fixed h-9 (a multi-line field sizes to its own rows instead) and
// minus the padding-variant hook only TextInput's icon/clear-button
// callers need.
export function textAreaClassName({ invalid = false, className }: TextAreaClassNameOptions): string {
  return cn(
    'w-full rounded-md border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground',
    'disabled:cursor-not-allowed disabled:opacity-50',
    invalid ? 'border-danger' : 'border-border',
    className,
  )
}
