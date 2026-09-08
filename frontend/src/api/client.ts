// Thin fetch wrapper. Requests go to /api/v1/... which Vite's dev server
// proxies to the backend container (see vite.config.ts) — no CORS setup
// needed in development.

const API_BASE = '/api/v1'

export interface HealthResponse {
  status: string
  dependencies: Record<string, string>
}

// Field names match the JSON wire format (snake_case, same as the
// backend's Pydantic schemas) rather than being renamed to camelCase.
export interface CheckpointListItem {
  id: number
  name: string
  family: string | null
  path: string
  parent_checkpoint_id: number | null
  serving_profile_name: string
  created_at: string
}

// One (checkpoint, recipe) pair with its most recent finished primary
// metric -- see app/schemas/leaderboard.py. Pivoting these into a grid
// is LeaderboardPage.helper.ts's job, not this type's.
export interface LeaderboardRow {
  checkpoint_id: number
  recipe_id: number
  benchmark: string
  recipe_hash: string
  label: string | null
  metric_name: string
  metric_value: number
  n_samples: number | null
  truncation_rate: number | null
  finished_at: string
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed with ${response.status}`)
  }
  return (await response.json()) as T
}
