import { cn } from '../../utils/cn'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

export function badgeClassName(tone: BadgeTone, className?: string): string {
  return cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
    TONE_CLASSES[tone],
    className,
  )
}
