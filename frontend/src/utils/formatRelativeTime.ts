// A timestamp as "3 hours ago" up to 7 days old, then a short date. How
// stale something is matters more than its exact wall-clock time up
// close; past a week, a reader wants to know *when*, not count days.
const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
// Locale left undefined (browser default) rather than hardcoded, same
// choice formatTimestamp.ts makes for toLocaleString().
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const SHORT_DATE_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

// `now` is a parameter, not `new Date()` inline, so a caller re-renders
// this with a fresh value on its own schedule (RelativeTime's
// polling-driven pages) instead of this function reading the clock
// itself on every call.
export function formatRelativeTime(timestamp: string, now: Date = new Date()): string {
  const date = new Date(timestamp)
  const elapsedMs = now.getTime() - date.getTime()

  if (elapsedMs < MINUTE_MS) {
    return 'just now'
  }
  if (elapsedMs < HOUR_MS) {
    return RELATIVE_TIME_FORMATTER.format(-Math.round(elapsedMs / MINUTE_MS), 'minute')
  }
  if (elapsedMs < DAY_MS) {
    return RELATIVE_TIME_FORMATTER.format(-Math.round(elapsedMs / HOUR_MS), 'hour')
  }
  if (elapsedMs < WEEK_MS) {
    return RELATIVE_TIME_FORMATTER.format(-Math.round(elapsedMs / DAY_MS), 'day')
  }
  const formatter =
    date.getFullYear() === now.getFullYear() ? SHORT_DATE_FORMATTER : SHORT_DATE_WITH_YEAR_FORMATTER
  return formatter.format(date)
}
