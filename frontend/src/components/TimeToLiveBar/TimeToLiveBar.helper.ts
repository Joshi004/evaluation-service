// Non-DOM logic for TimeToLiveBar.tsx: how much of a model server's
// SLURM walltime window is still left, and the caption that carries
// the same meaning in words (§4.5: never colour alone). `now` is a
// parameter, not `new Date()` read inline -- the caller re-renders this
// from its own ticker (ModelServerCard's useNow), the same "compute on
// read from a passed-in clock" choice RelativeTime and formatDuration
// already make.

export interface TimeToLive {
  // Fraction of the walltime window still remaining, clamped to
  // [0, 1] -- the bar's own fill: full right after a server starts,
  // empty as `expires_at` approaches. `null` means `created_at` or
  // `expires_at` couldn't be parsed, so the caller draws no bar at all
  // rather than one sized from NaN.
  fractionLeft: number | null
  label: string
  // True once 10 minutes or less remain -- ModelServerCard's own cue to
  // switch the bar and caption to the warning tone.
  endingSoon: boolean
}

const MINUTE_MS = 60_000
const ENDING_SOON_THRESHOLD_MS = 10 * MINUTE_MS

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// "1h 12m left" / "42m left" / "Under a minute left" -- mirrors
// formatDuration.ts's own hours/minutes ladder, but always says "left"
// and never says "expired": the endpoints list only ever contains rows
// the backend still considers live (`Endpoint.expires_at > now()`,
// app/services/endpoints/queries.py's list_live_endpoints), so a
// remaining time at or below zero here is this browser's clock running
// behind the server's, not a real expiry this page observed.
function describeRemaining(remainingMs: number): string {
  if (remainingMs <= 0) {
    return 'Ending now'
  }
  if (remainingMs < MINUTE_MS) {
    return 'Under a minute left'
  }
  const totalMinutes = Math.floor(remainingMs / MINUTE_MS)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`
}

export function computeTimeToLive(createdAt: string, expiresAt: string, now: Date): TimeToLive {
  const createdMs = new Date(createdAt).getTime()
  const expiresMs = new Date(expiresAt).getTime()

  if (!Number.isFinite(createdMs) || !Number.isFinite(expiresMs)) {
    return { fractionLeft: null, label: 'Time limit unknown', endingSoon: false }
  }

  const remainingMs = expiresMs - now.getTime()
  const endingSoon = remainingMs <= ENDING_SOON_THRESHOLD_MS

  const totalMs = expiresMs - createdMs
  // A non-positive total (a malformed row where created_at is at or
  // after expires_at) has nothing to show a fraction of -- an empty
  // bar is the honest rendering, not a divide-by-zero NaN.
  const fractionLeft = totalMs <= 0 ? 0 : clamp(remainingMs / totalMs, 0, 1)

  return { fractionLeft, label: describeRemaining(remainingMs), endingSoon }
}
