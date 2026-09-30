import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

// A styled native radio -- mirrors Checkbox's own pattern (a peer
// input plus an overlay drawn from its checked state), so the two read
// as one shape, and the input itself keeps native keyboard and form
// semantics instead of becoming a hand-built radio-group widget.
// Unlike Checkbox, the ring itself never fills solid -- only the inner
// dot appears -- which is what tells the two apart at a glance despite
// sharing one visual language.
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ className, ...rest }, ref) {
  return (
    <span className={cn('relative inline-flex h-4 w-4 shrink-0', className)}>
      <input
        ref={ref}
        type="radio"
        className={cn(
          'peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-muted',
          'checked:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...rest}
      />
      <span className="pointer-events-none absolute top-1/2 left-1/2 hidden h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary peer-checked:block" />
    </span>
  )
})
