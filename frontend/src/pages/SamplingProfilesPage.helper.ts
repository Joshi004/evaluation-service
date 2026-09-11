// Non-DOM logic for SamplingProfilesPage.tsx: reshaping a
// SamplingProfileSummary into the label/value rows its expanded row
// renders.
import type { SamplingProfileSummary } from '../api/client'

export interface SamplingProfileValueRow {
  field: string
  label: string
  value: string
}

// Every SamplingProfileConfig field, labelled the same way
// StandardsPage.helper.ts's SAMPLING_OVERRIDE_LABELS and
// RunDetailPage.helper.ts's samplingFieldRows both label them -- one
// label set for e.g. "temperature" across the app, not three.
export function buildSamplingValueRows(profile: SamplingProfileSummary): SamplingProfileValueRow[] {
  return [
    { field: 'temperature', label: 'Temperature', value: String(profile.temperature) },
    { field: 'top_p', label: 'Top-p', value: String(profile.top_p) },
    { field: 'top_k', label: 'Top-k', value: String(profile.top_k) },
    { field: 'min_p', label: 'Min-p', value: String(profile.min_p) },
    { field: 'presence_penalty', label: 'Presence penalty', value: String(profile.presence_penalty) },
    { field: 'repetition_penalty', label: 'Repetition penalty', value: String(profile.repetition_penalty) },
    { field: 'max_tokens', label: 'Max tokens', value: String(profile.max_tokens) },
    { field: 'enable_thinking', label: 'Enable thinking', value: profile.enable_thinking ? 'Yes' : 'No' },
    { field: 'seed', label: 'Seed', value: String(profile.seed) },
  ]
}
