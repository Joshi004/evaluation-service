// Non-DOM logic for SubmitGrid.tsx: flipping one id's membership in a
// selection array. Both the checkpoint list and the recipe list use
// this the same way, so it isn't duplicated per list.
export function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((existingId) => existingId !== id) : [...ids, id]
}
