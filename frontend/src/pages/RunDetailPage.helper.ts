// Non-DOM logic for RunDetailPage.tsx: formatting timestamps and
// reshaping a RunRecipeDetail into the label/value rows the page
// renders. Kept out of the component body per
// .cursor/rules/frontend-components.mdc -- "data should already be in
// the shape it needs by the time it reaches JSX."

import type { RunRecipeDetail } from '../api/client'

export function formatTimestamp(value: string | null): string {
  return value === null ? '—' : new Date(value).toLocaleString()
}

export interface FieldRow {
  label: string
  value: string
}

// `null` covers both the recipe's own nullable fields (dataset_revision,
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

// The fields a human needs to know exactly what ran, split into two
// groups (task/dataset shape, then sampling) purely for layout --
// RunDetailPage.tsx renders each group as its own two-column grid.
// prompt_template and extraction are intentionally left out: both are
// large blobs better suited to the Standards page's raw-YAML view than
// to a run's summary row.
export function taskFieldRows(recipe: RunRecipeDetail): FieldRow[] {
  return [
    { label: 'Benchmark', value: recipe.benchmark },
    { label: 'Framework', value: recipe.framework },
    { label: 'Framework image', value: recipe.framework_image },
    { label: 'Task', value: recipe.task_name },
    { label: 'Dataset', value: recipe.dataset_name },
    { label: 'Dataset revision', value: displayOrDash(recipe.dataset_revision) },
    { label: 'Split', value: displayOrDash(recipe.split) },
    { label: 'Few-shot', value: displayOrDash(recipe.few_shot) },
    { label: 'Repeats', value: displayOrDash(recipe.repeats) },
    { label: 'Sample limit', value: displayOrDash(recipe.sample_limit) },
  ]
}

export function samplingFieldRows(recipe: RunRecipeDetail): FieldRow[] {
  return [
    { label: 'Temperature', value: displayOrDash(recipe.temperature) },
    { label: 'Top-p', value: displayOrDash(recipe.top_p) },
    { label: 'Top-k', value: displayOrDash(recipe.top_k) },
    { label: 'Min-p', value: displayOrDash(recipe.min_p) },
    { label: 'Presence penalty', value: displayOrDash(recipe.presence_penalty) },
    { label: 'Repetition penalty', value: displayOrDash(recipe.repetition_penalty) },
    { label: 'Max tokens', value: displayOrDash(recipe.max_tokens) },
    { label: 'Enable thinking', value: displayOrDash(recipe.enable_thinking) },
    { label: 'Think handling', value: recipe.think_handling },
  ]
}
