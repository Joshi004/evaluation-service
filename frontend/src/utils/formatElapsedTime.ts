// Total wall time between two timestamps -- (end ?? now) - start, not
// some other pair of columns, so a run still waiting on a cold start
// still shows how long it's actually been going (RunsPage passes
// finished_at/created_at; RunDetailPage's full row needs the identical
// computation, which is why this lives here rather than in one page's
// helper). Recomputed at render time from a Date the caller passes in,
// the same "no separate ticker, let refetchInterval drive re-renders"
// choice EndpointsPage.helper.ts's formatTimeRemaining already makes.
export function formatElapsedTime(start: string, end: string | null, now: Date): string {
  const endTime = end ? new Date(end) : now
  const elapsedMs = Math.max(0, endTime.getTime() - new Date(start).getTime())

  const totalSeconds = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}
