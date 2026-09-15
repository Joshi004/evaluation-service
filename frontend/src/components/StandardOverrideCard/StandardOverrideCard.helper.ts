// Non-DOM logic for StandardOverrideCard.tsx.

// sample_limit's own resolved default can legitimately be null -- the
// catalog's own convention for "the full dataset" (catalog/standards/
// *.yaml, e.g. gsm8k-v1.yaml's `sample_limit: null # null = the full
// 1,319 test questions"), never null on a published run. A bare
// "null" placeholder would read like an error rather than a
// deliberate default, so this is the one field with a human
// placeholder instead of a plain `String(value)`.
export function sampleLimitPlaceholder(sampleLimit: number | null): string {
  return sampleLimit === null ? 'Full dataset' : String(sampleLimit)
}
