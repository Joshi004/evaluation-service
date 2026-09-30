// One row list -> one id -> row lookup. New evaluation's own wizard and
// page each needed this for checkpoints, standards, sampling profiles
// and serving profiles alike
// -- four near-identical functions collapsed into the one generic shape
// they all shared, once a fourth call site made the duplication obvious
// (frontend-components.mdc's own "promote once a second component needs
// the same logic" rule, one step further: this is the same logic for
// every row type that carries a numeric `id`, not just a second
// component).
export function indexById<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]))
}
