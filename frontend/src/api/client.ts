// Thin fetch wrapper. Requests go to /api/v1/... which Vite's dev server
// proxies to the backend container (see vite.config.ts) — no CORS setup
// needed in development.

const API_BASE = '/api/v1'

export interface HealthResponse {
  status: string
  dependencies: Record<string, string>
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed with ${response.status}`)
  }
  return (await response.json()) as T
}
