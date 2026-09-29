// Adds or removes `value` from `selected` -- MultiSelectMenu's own
// toggle, split out per .cursor/rules/frontend-components.mdc (no DOM
// or JSX reference, so it belongs here rather than inline in the
// component).
export function toggleMultiSelectValue(selected: string[], value: string): string[] {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
}
