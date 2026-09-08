import type { CheckpointListItem, StandardRecipe } from '../../api/client'
import { toggleId } from './SubmitGrid.helper'

interface SubmitGridProps {
  checkpoints: CheckpointListItem[]
  recipes: StandardRecipe[]
  selectedCheckpointIds: number[]
  selectedRecipeIds: number[]
  onCheckpointIdsChange: (ids: number[]) => void
  onRecipeIdsChange: (ids: number[]) => void
}

// The two independent multi-selects that together define a submit's
// grid. There is no per-cell selection: POST /runs always takes the
// full cartesian product of checkpoint_ids x recipe_ids
// (app/schemas/runs.py's CreateRunsRequest) -- one checkpoint against
// six recipes, or three checkpoints against two, never a sparse subset
// of cells.
export function SubmitGrid({
  checkpoints,
  recipes,
  selectedCheckpointIds,
  selectedRecipeIds,
  onCheckpointIdsChange,
  onRecipeIdsChange,
}: SubmitGridProps) {
  const runCount = selectedCheckpointIds.length * selectedRecipeIds.length

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-slate-300">Checkpoints</h3>
          <ul className="mt-2 space-y-1">
            {checkpoints.map((checkpoint) => (
              <li key={checkpoint.id}>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedCheckpointIds.includes(checkpoint.id)}
                    onChange={() =>
                      onCheckpointIdsChange(toggleId(selectedCheckpointIds, checkpoint.id))
                    }
                  />
                  {checkpoint.name}
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-300">Recipes</h3>
          <ul className="mt-2 space-y-1">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedRecipeIds.includes(recipe.id)}
                    onChange={() => onRecipeIdsChange(toggleId(selectedRecipeIds, recipe.id))}
                  />
                  {recipe.label}
                  <span className="text-xs text-slate-500">({recipe.benchmark})</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {selectedCheckpointIds.length} checkpoint{selectedCheckpointIds.length === 1 ? '' : 's'} ×{' '}
        {selectedRecipeIds.length} recipe{selectedRecipeIds.length === 1 ? '' : 's'} = {runCount} run
        {runCount === 1 ? '' : 's'}
      </p>
    </div>
  )
}
