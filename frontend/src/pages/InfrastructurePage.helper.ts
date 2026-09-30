// Non-DOM logic for InfrastructurePage.tsx: the useStartEndpoint
// failure toast's own message (docs/UI_REDESIGN_PLAN.md §8.13's
// InfrastructurePage bullet). An ApiError carries the backend's own
// detail (apiFetch's own extractErrorDetail); anything else -- a
// dropped connection, a timeout on a cold start that can genuinely
// take minutes -- means the request never got a real answer, so the
// row already written before sbatch ran (Trap T3) might still turn
// into a live server on its own.
import { ApiError } from '../api/client'
import { describeError } from '../utils/describeError'

export function describeStartFailure(error: Error, modelName: string): string {
  if (error instanceof ApiError) {
    return `Could not start a model server for ${modelName}: ${describeError(error)}`
  }
  return `Lost contact while starting ${modelName}. It may still be starting; check the list before trying again.`
}
