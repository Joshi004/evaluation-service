// Non-DOM logic for SystemHealthCard.tsx: turning useHealth's own
// result into rows. Only Database is hardcoded (app/api/v1/health.py
// reports exactly one dependency, `postgres`, today) rather than
// iterated generically from `dependencies` -- a second dependency
// would need a second named row here anyway, since each one deserves
// its own recognisable label, not a raw backend key.
import type { HealthResponse } from '../../api/client'
import type { BadgeTone } from '../Badge/Badge.helper'

export interface HealthRow {
  label: string
  status: string
  tone: BadgeTone
  // The dependency's own raw detail (e.g. "error: connection refused")
  // -- shown in a tooltip rather than inline, so one long message
  // never stretches the row.
  tooltip: string | null
}

interface BuildHealthRowsInput {
  isLoading: boolean
  isError: boolean
  data: HealthResponse | undefined
}

// Backend and Database mirror the same three-state shape -- "haven't
// heard back yet", "fine", "broken" -- so a reader learns the pattern
// once and reads both rows the same way.
export function buildHealthRows({ isLoading, isError, data }: BuildHealthRowsInput): HealthRow[] {
  const backendRow: HealthRow = isError
    ? { label: 'Backend', status: 'Unreachable', tone: 'danger', tooltip: null }
    : isLoading || !data
      ? { label: 'Backend', status: 'Checking\u2026', tone: 'neutral', tooltip: null }
      : { label: 'Backend', status: 'OK', tone: 'success', tooltip: null }

  const postgresStatus = data?.dependencies.postgres
  const databaseRow: HealthRow =
    postgresStatus === undefined
      ? { label: 'Database', status: 'Unknown', tone: 'neutral', tooltip: null }
      : postgresStatus === 'ok'
        ? { label: 'Database', status: 'OK', tone: 'success', tooltip: null }
        : { label: 'Database', status: 'Error', tone: 'danger', tooltip: postgresStatus }

  return [backendRow, databaseRow]
}
