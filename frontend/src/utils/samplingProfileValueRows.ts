// Reshapes a SamplingProfileSummary into the label/value rows a value
// table renders. Promoted here from SamplingProfilesPage.helper.ts once
// the old grid-wide SamplingProfilePicker (removed by Phase 8's
// per-checkpoint override cards) needed the same rows for its read-only
// display of the chosen profile (frontend-components.mdc: a second
// consumer is what promotes page-local logic to src/utils/). Stays here
// now that SamplingProfilesPage.tsx is its only consumer again --
// nothing demotes a helper back once promoted, and a second consumer
// may well return.
import type { SamplingProfileSummary } from '../api/client'

export interface SamplingProfileValueRow {
  field: string
  label: string
  value: string
}

// Every SamplingProfileConfig field's human label, keyed the same way
// runConfigFieldRows.ts's samplingFieldRows labels the same fields --
// one label set for e.g. "temperature" across the app, not two.
// Relocated from the deleted StandardsPage.helper.ts (as
// SAMPLING_OVERRIDE_LABELS) in Phase 12, docs/UI_REDESIGN_PLAN.md
// §8.12, once the Benchmark detail page's own Protocol tab became a
// second caller alongside DryRunPreview -- neither is a page about
// sampling *profiles* specifically, so the name drops "override" for
// the more accurate "field".
export const SAMPLING_FIELD_LABELS: Record<string, string> = {
  temperature: 'Temperature',
  top_p: 'Top-p',
  top_k: 'Top-k',
  min_p: 'Min-p',
  presence_penalty: 'Presence penalty',
  repetition_penalty: 'Repetition penalty',
  max_tokens: 'Max tokens',
  enable_thinking: 'Enable thinking',
  seed: 'Seed',
}

// Every SamplingProfileConfig field, labelled the same way
// RunDetailPage.helper.ts's samplingFieldRows labels them -- one
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
