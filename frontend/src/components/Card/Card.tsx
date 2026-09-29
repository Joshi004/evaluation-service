import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

// The one panel primitive -- every boxed section of a page (a form, a
// summary block, a chart) sits inside a Card instead of a hand-styled
// bordered div.
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)} {...rest}>
      {children}
    </div>
  )
}
