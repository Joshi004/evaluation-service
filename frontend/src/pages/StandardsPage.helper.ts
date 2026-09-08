import type { StandardRecipe } from '../api/client'

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

// Every scalar field on a standard, in the same order as the YAML files
// themselves, paired with a human label and its formatted value. Metrics
// aren't included -- they render as their own table (see StandardsPage).
export function buildFieldRows(standard: StandardRecipe): StandardFieldRow[] {
  const warningByField = new Map(standard.warnings.map((warning) => [warning.field, warning.message]))

  const fields: [field: string, label: string, value: string][] = [
    ['dataset_name', 'Dataset', standard.dataset_name],
    ['dataset_revision', 'Dataset revision', standard.dataset_revision ?? '—'],
    ['split', 'Split', standard.split ?? '—'],
    ['few_shot', 'Few-shot', String(standard.few_shot)],
    ['prompt_template', 'Prompt template', standard.prompt_template === '' ? '(empty)' : standard.prompt_template],
    ['extraction', 'Extraction', formatExtraction(standard.extraction)],
    ['repeats', 'Repeats', String(standard.repeats)],
    ['sample_limit', 'Sample limit', standard.sample_limit === null ? 'full dataset' : String(standard.sample_limit)],
    ['enable_thinking', 'Enable thinking', String(standard.enable_thinking)],
    ['think_handling', 'Think handling', standard.think_handling],
    ['temperature', 'Temperature', String(standard.temperature)],
    ['top_p', 'Top-p', String(standard.top_p)],
    ['top_k', 'Top-k', String(standard.top_k)],
    ['min_p', 'Min-p', String(standard.min_p)],
    ['presence_penalty', 'Presence penalty', String(standard.presence_penalty)],
    ['repetition_penalty', 'Repetition penalty', String(standard.repetition_penalty)],
    ['max_tokens', 'Max tokens', String(standard.max_tokens)],
  ]

  return fields.map(([field, label, value]) => ({
    field,
    label,
    value,
    warning: warningByField.get(field) ?? null,
  }))
}
