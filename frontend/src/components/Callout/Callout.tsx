import type { ReactNode } from 'react'
import { calloutClassName, CALLOUT_ICONS, type CalloutTone } from './Callout.helper'

interface CalloutProps {
  tone: CalloutTone
  title?: ReactNode
  children: ReactNode
  actions?: ReactNode
  className?: string
}

// The one tinted-box-with-icon primitive (Phase 12, docs/UI_REDESIGN_PLAN.md
// §8.12) -- generalises the hand-rolled bg-warning-soft/bg-danger-soft
// boxes InspectionSummary.tsx and DryRunPreview.tsx already style
// themselves (both left as-is for now; moving them onto this is a
// follow-up, not part of this phase). The Catalog health banner is
// its first real caller: a warning Callout with a Review action that
// opens the Manage catalog drawer.
export function Callout({ tone, title, children, actions, className }: CalloutProps) {
  const Icon = CALLOUT_ICONS[tone]
  return (
    <div className={calloutClassName(tone, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        {title && <p className="text-sm font-medium">{title}</p>}
        <div className="text-sm">{children}</div>
        {actions && <div className="mt-2 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
