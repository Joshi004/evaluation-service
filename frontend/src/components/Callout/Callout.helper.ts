import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '../../utils/cn'

export type CalloutTone = 'info' | 'warning' | 'danger'

// One icon per tone -- warning and danger share the same shape
// (AlertTriangle) since both are "something needs a look", differing
// only in how urgent that look is; info gets its own, matching
// LeaderboardHowToRead's existing use of the same icon for "explains
// something, doesn't need action".
export const CALLOUT_ICONS = {
  info: Info,
  warning: AlertTriangle,
  danger: AlertTriangle,
}

const TONE_CLASSES: Record<CalloutTone, string> = {
  info: 'border-info/30 bg-info-soft text-info',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  danger: 'border-danger/30 bg-danger-soft text-danger',
}

export function calloutClassName(tone: CalloutTone, className?: string): string {
  return cn('flex items-start gap-2 rounded-md border p-3', TONE_CLASSES[tone], className)
}
