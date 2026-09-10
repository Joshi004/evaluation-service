// A standard's own label-or-hash (Trap: an ad-hoc override has
// label=null, so the hash is the only thing that identifies it --
// app/models/standard.py). Both RunsPage (the standard column) and
// RunDetailPage (the resolved standard's heading) need this same
// fallback.
export function standardDisplayName(standardLabel: string | null, standardHash: string): string {
  return standardLabel ?? standardHash
}
