// Non-DOM logic for RunSamplePage.tsx: telling a 404 apart from any
// other request failure, so the page can show a clear not-found state
// (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 7: "An unknown
// sample key is a 404 and the page shows a clear not-found state")
// instead of the generic error banner every other query failure gets.

import { ApiError } from '../api/client'

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
