import { cn } from '../../utils/cn'

interface SpinnerProps {
  className?: string
  label?: string
}

// A small circular loader, coloured via `currentColor` so it always
// matches whatever text colour context it renders inside (a primary
// button, a plain page, ...). Decorative by default; pass `label` when
// it is the only indication that something is in progress, so screen
// readers announce it.
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <svg
      className={cn('h-4 w-4 animate-spin text-current', className)}
      viewBox="0 0 24 24"
      fill="none"
      role={label ? 'status' : 'presentation'}
      aria-label={label}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z"
      />
    </svg>
  )
}
