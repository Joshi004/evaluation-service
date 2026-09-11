import type { StandardSummary } from '../api/client'

export interface StandardFieldRow {
  field: string
  label: string
  value: string
  warning: string | null
}

// `extraction`'s only guaranteed key is `method` (it's shapeless per
// benchmark -- see app/schemas/standards.py) -- stringify the rest rather
// than assume a shape this page doesn't own.
function formatExtraction(extraction: Record<string, unknown>): string {
  const { method, ...rest } = extraction
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
  return `${String(method)}${extra}`
}

// Every SamplingProfileConfig field's human label, keyed the same way
// OverrideEditor.tsx labels the same fields -- sampling_overrides only
// ever carries a subset of these keys (S-D22 validates against the
// same field set at load time).
const SAMPLING_OVERRIDE_LABELS: Record<string, string> = {
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

// One row per key this standard's own sampling_overrides actually sets
// -- most standards set none, in which case sampling comes entirely
// from whichever sampling profile a submit picks (S-D4's three-layer
// merge). No placeholder row when empty: an empty override list is the
// normal case, not a missing value -- StandardsPage.tsx's own caption
// explains what an absent field means.
function samplingOverrideRows(
  samplingOverrides: Record<string, unknown>,
  warningByField: Map<string, string>,
): StandardFieldRow[] {
  return Object.entries(samplingOverrides).map(([field, value]) => ({
    field,
    label: SAMPLING_OVERRIDE_LABELS[field] ?? field,
    value: String(value),
    warning: warningByField.get(field) ?? null,
  }))
}

// Every scalar field on a standard, in the same order as the YAML files
// themselves, paired with a human label and its formatted value. Metrics
// aren't included -- they render as their own table (see StandardsPage).
// Protocol fields first, then whatever this standard's own
// sampling_overrides mandates (Phase 3 moved the rest of sampling off
// the standard entirely, onto sampling_profile).
export function buildFieldRows(standard: StandardSummary): StandardFieldRow[] {
  const warningByField = new Map(standard.warnings.map((warning) => [warning.field, warning.message]))

  const protocolFields: [field: string, label: string, value: string][] = [
    ['dataset_name', 'Dataset', standard.dataset_name],
    ['dataset_revision', 'Dataset revision', standard.dataset_revision ?? '—'],
    ['split', 'Split', standard.split ?? '—'],
    ['train_split', 'Train split', standard.train_split ?? '—'],
    ['few_shot', 'Few-shot', String(standard.few_shot)],
    ['prompt_template', 'Prompt template', standard.prompt_template === '' ? '(empty)' : standard.prompt_template],
    [
      'few_shot_prompt_template',
      'Few-shot prompt template',
      standard.few_shot_prompt_template ?? '—',
    ],
    ['extraction', 'Extraction', formatExtraction(standard.extraction)],
    ['repeats', 'Repeats', String(standard.repeats)],
    ['sample_limit', 'Sample limit', standard.sample_limit === null ? 'full dataset' : String(standard.sample_limit)],
    ['think_handling', 'Think handling', standard.think_handling],
    ['subsets', 'Subsets', standard.subsets.join(', ')],
    ['eval_batch_size', 'Eval batch size', String(standard.eval_batch_size)],
    ['request_timeout_seconds', 'Request timeout (s)', String(standard.request_timeout_seconds)],
  ]

  const protocolRows: StandardFieldRow[] = protocolFields.map(([field, label, value]) => ({
    field,
    label,
    value,
    warning: warningByField.get(field) ?? null,
  }))

  return [...protocolRows, ...samplingOverrideRows(standard.sampling_overrides, warningByField)]
}
