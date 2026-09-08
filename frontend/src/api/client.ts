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

// A live vLLM server -- see app/schemas/endpoints.py. gpus and
// checkpoint_name are joined in server-side (from serving_profile and
// checkpoint) so the Endpoints page can show both without a second
// round trip.
export interface EndpointListItem {
  id: number
  checkpoint_id: number
  checkpoint_name: string
  serving_profile_id: number
  gpus: number
  slurm_job_id: number | null
  url: string | null
  expires_at: string
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

// A recipe field whose value is recorded but has no effect for this
// recipe's framework -- e.g. a non-zero min_p under evalscope (decision
// D4). Computed by the backend, not stored.
export interface RecipeFieldWarning {
  field: string
  message: string
}

// One entry of a recipe's `metrics` array -- unlike `extraction` below,
// this has a fixed, strictly-validated shape (app/schemas/standards.py's
// RecipeMetricDefinition), so it's typed here rather than left as
// unknown.
export interface RecipeMetricDefinition {
  name: string
  display_name: string
  harness_key: string
  higher_is_better: boolean
  is_primary: boolean
}

// One reviewed standard (a `recipe` row with label IS NOT NULL) -- see
// app/schemas/standards.py. `extraction` stays untyped-shape (`unknown`,
// never `any`) since that DB column is genuinely shapeless per
// benchmark. `source_yaml` is the recipe's own YAML file, read verbatim
// -- comments included -- rather than parsed into per-field sources.
export interface StandardRecipe {
  id: number
  hash: string
  label: string
  benchmark: string
  framework: string
  framework_image: string
  task_name: string
  dataset_name: string
  dataset_revision: string | null
  split: string | null
  few_shot: number
  prompt_template: string
  extraction: Record<string, unknown>
  metrics: RecipeMetricDefinition[]
  repeats: number
  sample_limit: number | null
  temperature: number
  top_p: number
  top_k: number
  min_p: number
  presence_penalty: number
  repetition_penalty: number
  max_tokens: number
  enable_thinking: boolean
  think_handling: string
  created_at: string
  warnings: RecipeFieldWarning[]
  source_yaml: string | null
}

// FastAPI's HTTPException puts the human-readable reason in a `detail`
// field (e.g. endpoints.py's 502/504s: exit code, elapsed seconds) --
// worth surfacing verbatim in the UI instead of just a status code, so
// a failed cold start doesn't send someone straight to an SSH session.
function extractErrorDetail(body: unknown): string | null {
  if (body !== null && typeof body === 'object' && 'detail' in body) {
    const detail = (body as Record<string, unknown>).detail
    return typeof detail === 'string' ? detail : null
  }
  return null
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    throw new Error(
      extractErrorDetail(body) ?? `${init?.method ?? 'GET'} ${path} failed with ${response.status}`,
    )
  }
  // DELETE /endpoints/:id returns 204 with no body -- .json() would
  // throw on the empty response.
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
