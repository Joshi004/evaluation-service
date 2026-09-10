// Non-DOM logic for RunDetailPage.tsx: formatting timestamps and
// reshaping a run's resolved standard and resolved sampling profile
// into the label/value rows the page renders. Kept out of the
// component body per .cursor/rules/frontend-components.mdc -- "data
// should already be in the shape it needs by the time it reaches JSX."

import type { RunSamplingDetail, RunStandardDetail } from '../api/client'

export function formatTimestamp(value: string | null): string {
  return value === null ? '—' : new Date(value).toLocaleString()
}

export interface FieldRow {
  label: string
  value: string
}

// `null` covers both the standard's own nullable fields (dataset_revision,
// split, sample_limit) and the endpoint's slurm_job_id; numbers and
// booleans are stringified so every row in the resulting table is a
// plain string, matching FieldRow.
export function displayOrDash(value: string | number | boolean | null): string {
  if (value === null) {
    return '—'
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return String(value)
}

// The fields a human needs to know exactly what ran, from the resolved
// standard -- task/dataset shape plus think_handling, a protocol field
// (docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3 moved sampling off the
// standard entirely; see samplingFieldRows below for that half).
// prompt_template and extraction are intentionally left out: both are
// large blobs better suited to the Standards page's raw-YAML view than
// to a run's summary row.
export function standardFieldRows(standard: RunStandardDetail): FieldRow[] {
  return [
    { label: 'Benchmark', value: standard.benchmark },
    { label: 'Framework', value: standard.framework },
    { label: 'Framework image', value: standard.framework_image },
    { label: 'Task', value: standard.task_name },
    { label: 'Dataset', value: standard.dataset_name },
    { label: 'Dataset revision', value: displayOrDash(standard.dataset_revision) },
    { label: 'Split', value: displayOrDash(standard.split) },
    { label: 'Few-shot', value: displayOrDash(standard.few_shot) },
    { label: 'Repeats', value: displayOrDash(standard.repeats) },
    { label: 'Sample limit', value: displayOrDash(standard.sample_limit) },
    { label: 'Think handling', value: standard.think_handling },
  ]
}

// The fields a human needs to know exactly how the model was asked to
// speak, from the run's resolved sampling profile.
export function samplingFieldRows(sampling: RunSamplingDetail): FieldRow[] {
  return [
    { label: 'Temperature', value: displayOrDash(sampling.temperature) },
    { label: 'Top-p', value: displayOrDash(sampling.top_p) },
    { label: 'Top-k', value: displayOrDash(sampling.top_k) },
    { label: 'Min-p', value: displayOrDash(sampling.min_p) },
    { label: 'Presence penalty', value: displayOrDash(sampling.presence_penalty) },
    { label: 'Repetition penalty', value: displayOrDash(sampling.repetition_penalty) },
    { label: 'Max tokens', value: displayOrDash(sampling.max_tokens) },
    { label: 'Enable thinking', value: displayOrDash(sampling.enable_thinking) },
    { label: 'Seed', value: displayOrDash(sampling.seed) },
  ]
}
