import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Tooltip } from '../Tooltip/Tooltip'

interface TermLabelProps {
  hint: string
  children: ReactNode
  className?: string
}

// A jargon term (a column header, a field label) with a one-line
// explanation on hover or focus -- the dotted underline is this app's
// one "there's more here" affordance for plain text, since a bare
// <span> with a Tooltip gives no visual cue it holds anything. tabIndex
// makes the term reachable by keyboard, the same Tooltip+tabIndex
// pairing RunConfigTab.tsx's own inline "Setup" fingerprint chip
// already uses -- this component exists so every other jargon term
// doesn't have to repeat that pairing by hand.
export function TermLabel({ hint, children, className }: TermLabelProps) {
  return (
    <Tooltip content={hint}>
      <span
        tabIndex={0}
        className={cn(
          'cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2',
          className,
        )}
      >
        {children}
      </span>
    </Tooltip>
  )
}
