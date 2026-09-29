import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

// A styled native <select>, not a Radix Select -- it keeps real
// <option> semantics and each platform's own picker UI instead of a
// custom-built listbox.
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { invalid = false, className, children, ...rest },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={cn(
          'h-9 w-full appearance-none rounded-md border bg-muted px-3 pr-8 text-sm text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid ? 'border-danger' : 'border-border',
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
    </div>
  )
})
