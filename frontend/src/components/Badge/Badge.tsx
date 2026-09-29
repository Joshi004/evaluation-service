import type { ReactNode } from 'react'
import { badgeClassName, type BadgeTone } from './Badge.helper'

interface BadgeProps {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}

// The one coloured-pill primitive. StatusBadge and AvailabilityBadge
// (existing components, each with their own status-to-tone mapping)
// render through this instead of styling their own pill.
export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return <span className={badgeClassName(tone, className)}>{children}</span>
}
