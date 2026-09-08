import type { ProfileSource } from '../../data/types'
import type { StatusTone } from '../StatusBadge/StatusBadge.helper'

export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(0)}%`
}

const SOURCE_LABELS: Record<ProfileSource, string> = {
  benchmark_default: 'Benchmark default',
  user_provided: 'User provided',
  from_checkpoint: 'From checkpoint',
}

const SOURCE_TONES: Record<ProfileSource, StatusTone> = {
  benchmark_default: 'neutral',
  user_provided: 'info',
  from_checkpoint: 'warning',
}

export function profileSourceLabel(source: ProfileSource): string {
  return SOURCE_LABELS[source]
}

export function profileSourceTone(source: ProfileSource): StatusTone {
  return SOURCE_TONES[source]
}
