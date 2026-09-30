// Non-DOM logic for BenchmarkProtocolTab.tsx: turning a standard's own
// sparse sampling mandate into labelled rows, the same way
// samplingProfileValueRows.ts does for a full profile.

import type { StandardSummary } from '../api/client'
import { SAMPLING_FIELD_LABELS } from '../utils/samplingProfileValueRows'

export interface SamplingMandateRow {
  field: string
  label: string
  value: string
}

function formatMandateValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return String(value)
}

// `standard.sampling_overrides` is a sparse subset of the nine sampling
// fields (the second merge layer) -- only the fields a benchmark's own
// published definition actually mandates appear here at all, so most
// standards resolve to an empty array here.
export function buildSamplingMandateRows(standard: StandardSummary): SamplingMandateRow[] {
  return Object.entries(standard.sampling_overrides).map(([field, value]) => ({
    field,
    label: SAMPLING_FIELD_LABELS[field] ?? field,
    value: formatMandateValue(value),
  }))
}
