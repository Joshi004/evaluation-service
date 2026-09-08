// A recipe's own label-or-hash (Trap: an ad-hoc override has label=null,
// so the hash is the only thing that identifies it -- app/models/recipe.py).
// Both RunsPage (the recipe column) and RunDetailPage (the resolved
// recipe's heading) need this same fallback.
export function recipeDisplayName(recipeLabel: string | null, recipeHash: string): string {
  return recipeLabel ?? recipeHash
}
