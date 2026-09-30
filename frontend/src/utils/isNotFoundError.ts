// Tells a 404 apart from any other request failure, so a page can show
// a clear not-found state instead of the generic error banner every
// other query failure gets.

import { ApiError } from '../api/client'

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
