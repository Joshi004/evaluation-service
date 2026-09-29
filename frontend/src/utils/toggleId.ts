// Flips one id's membership in a selection array, preserving the order
// ids were added in -- both ModelPicker and BenchmarkPicker use this
// the same way New evaluation's Choose step needs it (a model or
// benchmark clicked first stays first in checkpoint_ids/standard_ids,
// matching the order a person built the grid in). Promoted from
// SubmitGrid.helper.ts (removed in Phase 10, docs/UI_REDESIGN_PLAN.md
// §8.10) once a second caller needed the same logic.
export function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((existingId) => existingId !== id) : [...ids, id]
}
