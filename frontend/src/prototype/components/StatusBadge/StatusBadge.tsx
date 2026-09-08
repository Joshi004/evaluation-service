import { toneClasses, type StatusTone } from './StatusBadge.helper'

interface StatusBadgeProps {
  label: string
  tone: StatusTone
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses(tone)}`}>{label}</span>
}
