import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useRuns } from '../../api/queries/runs'
import {
  findPinRefusal,
  revalidatePinnedRuns,
  toPinnedRun,
  type CompareCandidate,
  type PinnedRun,
} from '../../utils/compareTray'
import { CompareTrayContext } from '../../utils/useCompareTray'
import { readPinnedRunsFromSession, writePinnedRunsToSession } from './CompareTrayProvider.helper'

interface CompareTrayProviderProps {
  children: ReactNode
}

// Mounted once in main.tsx, above <BrowserRouter> -- every route shares
// one tray instead of each page holding its own state. A tray restored
// from sessionStorage can point at a run that was cancelled since, or
// (in development) predate a database reset, so it is revalidated
// exactly once against the server's current `done` list before
// anything treats it as trustworthy.
export function CompareTrayProvider({ children }: CompareTrayProviderProps) {
  const [pinnedRuns, setPinnedRuns] = useState<PinnedRun[]>(readPinnedRunsFromSession)
  const [needsRevalidation, setNeedsRevalidation] = useState(pinnedRuns.length > 0)

  // Only fetched when there is something restored to check -- the
  // common case (a fresh tab, an empty tray) never issues this request
  // at all.
  const doneRuns = useRuns({ status: 'done' }, { enabled: needsRevalidation })

  // Adjusts state during render (the same pattern AppShell uses to
  // reset its drawer on navigation) rather than in an effect:
  // revalidating is a one-time correction of the initial state, not a
  // response to a later event, so doing it here saves an extra
  // commit-and-rerender.
  if (needsRevalidation && doneRuns.data !== undefined) {
    setNeedsRevalidation(false)
    setPinnedRuns(revalidatePinnedRuns(pinnedRuns, doneRuns.data))
  }

  useEffect(() => {
    writePinnedRunsToSession(pinnedRuns)
  }, [pinnedRuns])

  function isPinned(runId: number): boolean {
    return pinnedRuns.some((run) => run.runId === runId)
  }

  // Re-checks findPinRefusal itself rather than trusting the caller --
  // AddToCompareButton already disables the control for a refused pin,
  // but this is the one place the rule is actually enforced.
  function pinRun(candidate: CompareCandidate): void {
    if (findPinRefusal(pinnedRuns, candidate) !== null) {
      return
    }
    setPinnedRuns([...pinnedRuns, toPinnedRun(candidate)])
  }

  function unpinRun(runId: number): void {
    setPinnedRuns(pinnedRuns.filter((run) => run.runId !== runId))
  }

  function clearTray(): void {
    setPinnedRuns([])
  }

  return (
    <CompareTrayContext.Provider value={{ pinnedRuns, isPinned, pinRun, unpinRun, clearTray }}>
      {children}
    </CompareTrayContext.Provider>
  )
}
