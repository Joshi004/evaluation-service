// Promoted from InfrastructurePage.helper.ts once ChatPage.tsx became a
// second caller (its own "Start a model server" entry point for a
// model with no live server) -- see .cursor/rules/frontend-components.mdc's
// "once a second component needs the same logic" rule.
//
// The useStartEndpoint failure toast's own message. An ApiError
// carries the backend's own detail (apiFetch's own extractErrorDetail);
// anything else -- a dropped connection, a timeout on a cold start that
// can genuinely take minutes -- means the request never got a real
// answer, so the row already written before sbatch ran (Trap T3) might
// still turn into a live server on its own.
import { ApiError } from '../api/client'
import { describeError } from './describeError'

export function describeStartFailure(error: Error, modelName: string): string {
  if (error instanceof ApiError) {
    return `Could not start a model server for ${modelName}: ${describeError(error)}`
  }
  return `Lost contact while starting ${modelName}. It may still be starting; check the list before trying again.`
}
