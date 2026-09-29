// A full timestamp in the browser's own locale -- used wherever the
// exact moment matters (a run's created/started/finished times, the
// tooltip behind a RelativeTime). Promoted from RunDetailPage.helper.ts
// once RelativeTime (Phase 4) became a second user. Locale left
// undefined (browser default) rather than hardcoded.
export function formatTimestamp(value: string | null): string {
  return value === null ? '—' : new Date(value).toLocaleString()
}
