// Non-DOM logic for CompareTrayProvider.tsx: reading and writing the
// tray's sessionStorage entry. Session-scoped, not local-storage, so
// the tray is per-tab (§8.5's own acceptance criterion) rather than
// shared across every tab a person has open.
import type { PinnedRun } from '../../utils/compareTray'

const STORAGE_KEY = 'eval.compareTray.v1'

function isPinnedRun(value: unknown): value is PinnedRun {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.runId === 'number' &&
    typeof candidate.benchmark === 'string' &&
    typeof candidate.comparisonHash === 'string' &&
    typeof candidate.modelName === 'string' &&
    (candidate.samplingProfileLabel === null || typeof candidate.samplingProfileLabel === 'string') &&
    typeof candidate.samplingProfileHash === 'string' &&
    (candidate.scoreFraction === null || typeof candidate.scoreFraction === 'number')
  )
}

// Reads whatever a previous session in this tab persisted. Anything
// that fails to parse, isn't an array, or has an entry missing one of
// PinnedRun's fields is dropped rather than partially trusted -- there
// are no real users yet, so "start empty" is simpler and just as safe
// as migrating an old shape.
export function readPinnedRunsFromSession(): PinnedRun[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isPinnedRun) : []
  } catch {
    return []
  }
}

// Removes the key entirely once the tray is empty, rather than storing
// "[]", so an empty tray leaves nothing behind in devtools' storage
// panel.
export function writePinnedRunsToSession(pinnedRuns: PinnedRun[]): void {
  try {
    if (pinnedRuns.length === 0) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedRuns))
  } catch {
    // Losing the persisted tray costs a re-pin next session, not
    // correctness -- the same tolerance useLocalStorageState.ts applies.
  }
}
