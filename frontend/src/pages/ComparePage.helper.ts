// Non-DOM logic for ComparePage.tsx: the canonical ?runs= URL contract
// and how a run already in that list, once loaded, turns out to be
// unusable. Only this page needs these -- once a shape here is needed
// by a second component (like ComparePairState), it moves to
// src/utils/ instead (.cursor/rules/frontend-components.mdc).
import type { UseQueryResult } from '@tanstack/react-query'
import type { RunDetail } from '../api/client'
import { MAX_COMPARE_RUNS } from '../utils/compareTray'
import { isNotFoundError } from '../utils/isNotFoundError'
import { RUN_STATUS_LABELS } from '../utils/labels'
import { paths } from '../utils/paths'
import { readNumberListParam } from '../utils/useUrlState'

function parsePositiveInt(value: string | null): number | null {
  if (value === null) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

// Drops non-positive and duplicate ids (first occurrence wins) and
// caps at MAX_COMPARE_RUNS -- the list a shared link should always
// resolve back to, so resolveCompareRedirect below can tell a URL
// that already IS canonical from one that needs cleaning up.
export function normalizeRunIds(rawRunIds: number[]): number[] {
  const seen = new Set<number>()
  const normalized: number[] = []
  for (const runId of rawRunIds) {
    if (runId <= 0 || seen.has(runId)) {
      continue
    }
    seen.add(runId)
    normalized.push(runId)
    if (normalized.length === MAX_COMPARE_RUNS) {
      break
    }
  }
  return normalized
}

export function parseCompareRunIds(searchParams: URLSearchParams): number[] {
  return normalizeRunIds(readNumberListParam(searchParams, 'runs'))
}

// `/compare?left=&right=` is the URL format from before `?runs=`, and
// that link must keep working; a `runs` list that needed cleaning (a
// duplicate, an invalid id, or more than MAX_COMPARE_RUNS entries)
// also earns a redirect, so a copied link always settles on the one
// URL it will keep resolving to. `null` means the URL is already
// canonical -- nothing to redirect.
export function resolveCompareRedirect(searchParams: URLSearchParams): string | null {
  if (!searchParams.has('runs')) {
    const left = parsePositiveInt(searchParams.get('left'))
    const right = parsePositiveInt(searchParams.get('right'))
    const legacyIds = normalizeRunIds([left, right].filter((id): id is number => id !== null))
    return legacyIds.length > 0 ? paths.compare(legacyIds) : null
  }

  const parsedIds = readNumberListParam(searchParams, 'runs')
  const normalizedIds = normalizeRunIds(parsedIds)
  const isCanonical =
    parsedIds.length === normalizedIds.length && parsedIds.every((id, index) => id === normalizedIds[index])
  return isCanonical ? null : paths.compare(normalizedIds)
}

export function parseFlipsRunId(searchParams: URLSearchParams): number | null {
  return parsePositiveInt(searchParams.get('flips'))
}

export type ProblemReason = 'not-found' | 'not-finished' | 'load-error'

export interface ProblemRun {
  runId: number
  reason: ProblemReason
  // Only meaningful for 'not-finished' -- queued/running/failed/
  // cancelled all read differently, so the message can say which.
  status: string | null
}

// A run qualifies the same way the compare tray's own findPinRefusal
// does (status === 'done') -- that same rule, applied per row once the
// run is actually loaded instead of at pin time.
export function classifyProblemRun(runId: number, query: UseQueryResult<RunDetail>): ProblemRun | null {
  if (query.isError) {
    return { runId, reason: isNotFoundError(query.error) ? 'not-found' : 'load-error', status: null }
  }
  if (query.data && query.data.status !== 'done') {
    return { runId, reason: 'not-finished', status: query.data.status }
  }
  return null
}

export function describeProblemRun(problem: ProblemRun): string {
  switch (problem.reason) {
    case 'not-found':
      return `Run #${problem.runId} doesn't exist.`
    case 'not-finished':
      return `Run #${problem.runId} is ${RUN_STATUS_LABELS[problem.status ?? ''] ?? problem.status} — only finished runs can be compared.`
    case 'load-error':
      return `Run #${problem.runId} could not be loaded.`
  }
}
