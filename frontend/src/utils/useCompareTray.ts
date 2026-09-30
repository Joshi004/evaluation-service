// The compare tray's context and hook, kept out of
// CompareTrayProvider.tsx: oxlint's react/only-export-components rule
// (frontend/.oxlintrc.json) wants a component file to export only
// components, and this file exports neither -- just the context object
// and the hook that reads it.
import { createContext, useContext } from 'react'
import type { CompareCandidate, PinnedRun } from './compareTray'

export interface CompareTrayContextValue {
  pinnedRuns: PinnedRun[]
  isPinned: (runId: number) => boolean
  pinRun: (candidate: CompareCandidate) => void
  unpinRun: (runId: number) => void
  clearTray: () => void
}

export const CompareTrayContext = createContext<CompareTrayContextValue | null>(null)

// Throws rather than returning a nullable value, so every consumer
// (AddToCompareButton, CompareTray, the sidebar badge) can use the
// result directly -- CompareTrayProvider is mounted once in main.tsx,
// above every route, so a missing provider means a wiring mistake, not
// a state worth handling gracefully.
export function useCompareTray(): CompareTrayContextValue {
  const context = useContext(CompareTrayContext)
  if (context === null) {
    throw new Error('useCompareTray must be used within a CompareTrayProvider')
  }
  return context
}
