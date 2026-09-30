// Adds or removes `value` from `selected` -- MultiSelectMenu's own
// toggle, split out per .cursor/rules/frontend-components.mdc (no DOM
// or JSX reference, so it belongs here rather than inline in the
// component).
export function toggleMultiSelectValue(selected: string[], value: string): string[] {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
}

// The trigger's own " (2)" suffix once at least one option is picked.
// The component's own concern now that the trigger itself is built
// into MultiSelectMenu rather than passed in by each caller -- before,
// every caller (LeaderboardToolbar, ModelsToolbar) duplicated this.
export function countSuffix(count: number): string {
  return count > 0 ? ` (${count})` : ''
}
