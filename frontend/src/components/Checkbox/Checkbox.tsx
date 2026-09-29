import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../utils/cn'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

// A styled native checkbox -- the checkmark is an icon drawn on top
// and shown via the `peer-checked` state, so the input itself keeps
// native keyboard and form semantics instead of becoming a hand-built
// listbox-style widget.
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, ...rest },
  ref,
) {
  return (
    <span className={cn('relative inline-flex h-4 w-4 shrink-0', className)}>
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-border bg-muted',
          'checked:border-primary checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...rest}
      />
      <Check className="pointer-events-none absolute inset-0 hidden h-4 w-4 text-primary-foreground peer-checked:block" />
    </span>
  )
})
