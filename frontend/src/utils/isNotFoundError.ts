// Tells a 404 apart from any other request failure, so a page can show
// a clear not-found state (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
// Phase 7: "An unknown sample key is a 404 and the page shows a clear
// not-found state") instead of the generic error banner every other
// query failure gets. Promoted from RunSamplePage.helper.ts (Phase 7)
// once the run report's SamplePanel became a second caller.

import { ApiError } from '../api/client'

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
