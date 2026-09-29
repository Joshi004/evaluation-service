import type { BadgeTone } from '../Badge/Badge.helper'
import type { HealthResponse } from '../../api/client'

interface SystemStatusInput {
  isLoading: boolean
  isError: boolean
  data: HealthResponse | undefined
}

interface SystemStatusStyle {
  label: string
  tone: BadgeTone
}

// Dot colour per tone -- Badge's own TONE_CLASSES pairs a tone with a
// soft-background pill, which is the wrong shape for a small status
// dot, so this is its own small map rather than reusing Badge's.
export const SYSTEM_STATUS_DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

// `status` is already the backend's own rollup (app/api/v1/health.py
// sets it to "degraded" the moment any dependency fails), so this
// trusts that field directly rather than re-deriving it from
// `dependencies` -- there is exactly one source of truth for "is
// anything wrong", and it isn't this frontend.
export function classifySystemStatus({ isLoading, isError, data }: SystemStatusInput): SystemStatusStyle {
  if (isError) {
    return { label: 'Unreachable', tone: 'danger' }
  }
  if (isLoading || !data) {
    return { label: 'Checking…', tone: 'neutral' }
  }
  return data.status === 'ok' ? { label: 'All systems ok', tone: 'success' } : { label: 'Degraded', tone: 'warning' }
}
