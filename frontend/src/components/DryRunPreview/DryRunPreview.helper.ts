// Non-DOM logic for DryRunPreview.tsx: stringifying the `unknown`
// before/after values in a ResolvedRecipePreview's changed_fields.
// They're `unknown` rather than a narrower type because a recipe
// field's value is genuinely dynamic across fields -- a float for
// temperature, a dict for extraction (app/schemas/runs.py's
// RecipeFieldChange) -- so this narrows before formatting instead of
// assuming a shape.
export function formatPreviewValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}
