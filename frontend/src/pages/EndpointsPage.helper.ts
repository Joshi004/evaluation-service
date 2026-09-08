// Non-DOM logic for EndpointsPage.tsx: formatting the time remaining
// before an endpoint's SLURM walltime runs out, and totalling GPU
// usage across every live endpoint. Time remaining is derived at render
// time from expires_at (the same "compute on read, don't store a
// computed column" approach the leaderboard uses) -- EndpointsPage.tsx
// re-renders this every 5s via the endpoints query's refetchInterval,
// which is what keeps it live without a separate client-side ticker.

import type { EndpointListItem } from '../api/client'

export function formatTimeRemaining(expiresAt: string, now: Date = new Date()): string {
  const remainingMs = new Date(expiresAt).getTime() - now.getTime()
  if (remainingMs <= 0) {
    return 'expired'
  }

  const totalMinutes = Math.floor(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export function sumGpus(endpoints: EndpointListItem[]): number {
  return endpoints.reduce((total, endpoint) => total + endpoint.gpus, 0)
}
