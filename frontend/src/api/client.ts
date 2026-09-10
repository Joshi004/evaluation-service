// Thin fetch wrapper. Requests go to /api/v1/... which Vite's dev server
// proxies to the backend container (see vite.config.ts) — no CORS setup
// needed in development.

// Exported so LogStream.helper.ts can build an EventSource URL against
// the same base -- EventSource has no fetch-wrapper equivalent to
// apiFetch above, so it needs this constant directly.
export const API_BASE = '/api/v1'

export interface HealthResponse {
  status: string
  dependencies: Record<string, string>
}

// Independent of registration (R-D1): a checkpoint stays listed even if
// the weights behind it later vanish -- 'unknown' is the honest state
// for a row nobody has checked yet.
export type CheckpointAvailabilityStatus = 'unknown' | 'available' | 'unavailable' | 'incomplete'

// Field names match the JSON wire format (snake_case, same as the
// backend's Pydantic schemas) rather than being renamed to camelCase.
export interface CheckpointListItem {
  id: number
  name: string
  family: string | null
  path: string
  parent_checkpoint_id: number | null
  // Joined in from serving_profile -- label is null for an ad-hoc
  // customisation (R-D16), in which case hash is what identifies it.
  // See utils/servingProfileDisplayName.ts for the label-or-hash rule.
  serving_profile_label: string | null
  serving_profile_hash: string
  // Joined in from sampling_profile, same reasoning -- named with the
  // default_ prefix (unlike serving_profile_label/_hash above) because
  // docs/STANDARDS_AND_PROFILES_PHASES.md Phase 2 names it explicitly.
  default_sampling_profile_label: string | null
  default_sampling_profile_hash: string
  created_at: string
  availability_status: CheckpointAvailabilityStatus
  availability_checked_at: string | null
  availability_detail: string | null
}

// What inspection read off the cluster at registration -- see
// app/schemas/checkpoints.py's CheckpointInferredMetadata. Every field
// is nullable: null means "we could not read this," not "empty" (R-D20).
// source_config is `Record<string, unknown> | null`, not `any` (R-T24)
// -- its shape genuinely varies by model family.
export interface CheckpointInferredMetadata {
  model_type: string | null
  architecture: string | null
  base_model: string | null
  context_length: number | null
  torch_dtype: string | null
  quantization: string | null
  weight_format: string | null
  shard_count: number | null
  size_bytes: number | null
  source_config: Record<string, unknown> | null
}

// One eval_run row belonging to a checkpoint -- see
// app/schemas/checkpoints.py's CheckpointRunSummary. Always empty until
// a later phase submits real jobs against a registered checkpoint.
export interface CheckpointRunSummary {
  id: number
  recipe_id: number
  status: string
  created_at: string
  finished_at: string | null
}

// GET /api/v1/checkpoints/{id} -- see app/schemas/checkpoints.py's
// CheckpointDetail. Fetched lazily by CheckpointInferredPanel when a
// checkpoints-page row is expanded (Phase 8), not on the list itself.
export interface CheckpointDetail extends CheckpointListItem {
  generation_config: Record<string, unknown> | null
  registered_by: string | null
  inferred: CheckpointInferredMetadata
  runs: CheckpointRunSummary[]
}

// Serving-profile wire shapes (docs/CHECKPOINT_REGISTRATION_PHASES.md
// Section 0.5, Phases 3 and 5). ServingProfileConfig is the eleven-field
// hashable config a customisation submits -- identical to
// ServingProfile.as_hashable_dict()'s key set. engine_options is an
// escape hatch for uncommon engine flags (R-D6); the registration
// wizard doesn't expose it for editing, so a customisation carries it
// through unchanged from whichever profile it started from.
export interface ServingProfileConfig {
  engine: string
  engine_version: string
  gpus: number
  tensor_parallel_size: number
  pipeline_parallel_size: number
  max_model_len: number | null
  reasoning_parser: string | null
  dtype: string
  quantization: string | null
  gpu_memory_utilization: number
  engine_options: Record<string, string | number | boolean>
}

// A persisted profile row -- every ServingProfileConfig field plus
// identity. label is null for an ad-hoc customisation (R-D16), in which
// case hash is what identifies it (see utils/servingProfileDisplayName.ts).
// Carries the full config, not just the fields a table would show at a
// glance, so a "customise" form can seed its draft from whichever
// summary is currently selected without silently resetting the fields
// it doesn't display.
export interface ServingProfileSummary extends ServingProfileConfig {
  id: number
  hash: string
  label: string | null
}

// Registration's suggested profile for a freshly-inspected checkpoint,
// attached to CheckpointInspection by the controller
// (app.services.checkpoints.recommendation). `reason` is never empty --
// a recommendation the user can't see the basis for is one they'll
// ignore. `profile` is null when nothing fits; `reason` still explains
// why.
export interface ServingProfileRecommendation {
  profile: ServingProfileSummary | null
  reason: string
}

// Sampling-profile wire shapes (docs/STANDARDS_AND_PROFILES_PHASES.md
// Section 0.5, Phase 2). SamplingProfileConfig is the nine-field
// hashable config -- identical to SamplingProfile.as_hashable_dict()'s
// key set. Types only, this phase: nothing in the frontend renders
// these yet (Phase 7 adds a picker).
export interface SamplingProfileConfig {
  temperature: number
  top_p: number
  top_k: number
  min_p: number
  presence_penalty: number
  repetition_penalty: number
  max_tokens: number
  enable_thinking: boolean
  seed: number
}

// A persisted profile row -- every SamplingProfileConfig field plus
// identity. label is null for an ad-hoc customisation (Phase 3+), in
// which case hash is what identifies it -- mirrors ServingProfileSummary.
export interface SamplingProfileSummary extends SamplingProfileConfig {
  id: number
  hash: string
  label: string | null
}

// Registration's suggested sampling profile for a freshly-inspected
// checkpoint, attached to CheckpointInspection by the controller
// (app.services.checkpoints.recommendation). `reason` is never empty --
// mirrors ServingProfileRecommendation.
export interface SamplingProfileRecommendation {
  profile: SamplingProfileSummary | null
  reason: string
}

// One directory on the cluster that looks evaluable -- not yet a
// database row (Phase 2). `already_registered` is set server-side by
// comparing `reference` against every registered checkpoint's path, so
// the frontend never has to do that matching itself (R-D32).
export interface CheckpointCandidate {
  reference: string
  display_name: string
  already_registered: boolean
  modified_at: string | null
}

// Everything readable about one candidate (Phase 2). A partial
// inspection is still a success (R-D15): an unreadable optional file
// shows up as a line in `problems` with its field left null, not as a
// thrown error -- `readable` is false only when config.json itself
// couldn't be read. source_config/generation_config are
// `Record<string, unknown> | null`, not `any` (R-T24) -- their shape
// genuinely varies by model family.
export interface CheckpointInspection {
  reference: string
  display_name: string
  model_type: string | null
  architecture: string | null
  base_model: string | null
  context_length: number | null
  torch_dtype: string | null
  quantization: string | null
  weight_format: string | null
  shard_count: number | null
  size_bytes: number | null
  generation_config: Record<string, unknown> | null
  source_config: Record<string, unknown> | null
  readable: boolean
  problems: string[]
  recommendation: ServingProfileRecommendation | null
  sampling_recommendation: SamplingProfileRecommendation | null
}

// POST /checkpoints' `serving_profile` field -- a union, not two
// optional fields, because the backend's model_validator rejects a
// request unless exactly one of these is set. Modelling it as two
// optional fields would let the wizard construct the one shape (both
// set, or neither) that always 422s with an array-shaped `detail`
// apiFetch cannot render as a single readable string.
export type ServingProfileSelection =
  | { existing_profile_id: number }
  | { customised: ServingProfileConfig }

// POST /api/v1/checkpoints' body. Deliberately excludes model_type,
// architecture, context_length, and every other inferred field -- the
// server re-reads a fresh inspection itself and writes those columns
// from its own reading (R-D4), so the wizard's job is to confirm, name,
// and choose what genuinely can't be inferred.
export interface RegisterCheckpointRequest {
  reference: string
  name: string
  family?: string | null
  parent_checkpoint_id?: number | null
  serving_profile: ServingProfileSelection
  // Optional, unlike serving_profile: omitted means "the checkpoint's
  // recommended default," computed server-side (S-D9). No picker
  // exists yet to set this from the wizard (Phase 7).
  sampling_profile_id?: number | null
  registered_by?: string | null
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

// One eval_run row, enriched server-side with the names a human needs
// to read it without a second round trip -- see app/schemas/runs.py's
// RunListItem. recipe_label falls back to null for an unlabelled
// override, in which case recipe_hash is what identifies it.
export interface RunListItem {
  id: number
  run_group_id: number
  run_group_name: string
  checkpoint_id: number
  checkpoint_name: string
  recipe_id: number
  recipe_label: string | null
  recipe_hash: string
  benchmark: string
  endpoint_id: number | null
  status: string
  truncation_rate: number | null
  error: string | null
  submitted_by: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

// A user override of a base recipe's fields -- see app/schemas/runs.py's
// RecipeOverrides. Every field is optional and nullable: a key left out
// entirely means "don't touch this field" (the backend's
// `exclude_unset=True`), while a key present with `null` is itself an
// override -- dataset_revision, split and sample_limit are legitimately
// nullable. Only include a key here once the caller has actually set
// it.
export interface RecipeOverrides {
  benchmark?: string | null
  framework?: string | null
  framework_image?: string | null
  task_name?: string | null
  dataset_name?: string | null
  dataset_revision?: string | null
  split?: string | null
  few_shot?: number | null
  prompt_template?: string | null
  extraction?: Record<string, unknown> | null
  metrics?: Record<string, unknown>[] | null
  repeats?: number | null
  sample_limit?: number | null
  temperature?: number | null
  top_p?: number | null
  top_k?: number | null
  min_p?: number | null
  presence_penalty?: number | null
  repetition_penalty?: number | null
  max_tokens?: number | null
  enable_thinking?: boolean | null
  think_handling?: string | null
}

// POST /api/v1/runs body -- every (checkpoint, recipe) pair in the
// cartesian product of checkpoint_ids x recipe_ids becomes one queued
// run, all sharing one new run_group.
export interface CreateRunsRequest {
  name: string
  checkpoint_ids: number[]
  recipe_ids: number[]
  overrides: RecipeOverrides
  submitted_by?: string | null
}

export interface RunSubmission {
  run_group_id: number
  run_ids: number[]
}

export interface RunGroupCancellation {
  run_group_id: number
  cancelled_run_ids: number[]
}

// POST /api/v1/runs/preview body -- the same grid shape as
// CreateRunsRequest minus `name` and `submitted_by`.
export interface RunPreviewRequest {
  checkpoint_ids: number[]
  recipe_ids: number[]
  overrides: RecipeOverrides
}

// One compatibility rule's result -- see app/schemas/compatibility.py's
// CompatibilityFinding. No `severity` field: which list a finding is in
// (errors vs warnings, below) is what determines that.
export interface CompatibilityFinding {
  code: string
  field: string
  message: string
}

// One (checkpoint, recipe) cell of the grid a submit would create.
// errors/warnings are the exact findings POST /runs would 400 on for
// this pair -- computed by the same backend functions that raise it, so
// this and a real submit can never disagree about what a value does.
export interface RunPreviewPair {
  checkpoint_id: number
  checkpoint_name: string
  recipe_id: number
  recipe_label: string | null
  benchmark: string
  errors: CompatibilityFinding[]
  warnings: CompatibilityFinding[]
}

// One field an override would change from the base recipe's value.
// base_value/override_value are `unknown`, not `any` -- a recipe
// field's value is genuinely dynamic across fields (a number for
// temperature, an object for extraction), so the caller has to narrow
// before using either.
export interface RecipeFieldChange {
  field: string
  base_value: unknown
  override_value: unknown
}

// What resolve_recipe would do for one base recipe plus the submit's
// overrides, without actually doing it -- see app/services/runs/preview.py.
export interface ResolvedRecipePreview {
  base_recipe_id: number
  hash: string
  is_new_recipe: boolean
  changed_fields: RecipeFieldChange[]
  warnings: RecipeFieldWarning[]
}

// Response for POST /api/v1/runs/preview -- everything the Submit page
// needs to render before anything POSTs.
export interface RunPreview {
  run_count: number
  gpu_count: number
  pairs: RunPreviewPair[]
  resolved_recipes: ResolvedRecipePreview[]
}

export interface RunMetric {
  name: string
  value: number
  n_samples: number | null
  is_primary: boolean
}

// The vLLM server a run ran against -- just enough to show whether it's
// still live, not the full EndpointListItem shape (checkpoint_name and
// gpus are already known from the run itself).
export interface RunEndpointSummary {
  id: number
  url: string | null
  slurm_job_id: number | null
  expires_at: string
}

// The fully resolved recipe a run actually used -- the same fields as
// StandardRecipe minus source_yaml, which only exists for a reviewed
// standard, not an ad-hoc override.
export interface RunRecipeDetail {
  id: number
  hash: string
  label: string | null
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
}

// GET /api/v1/runs/{id} -- the full row (RunListItem) plus what a human
// reads to actually understand what happened.
export interface RunDetail extends RunListItem {
  output_dir: string | null
  recipe: RunRecipeDetail
  endpoint: RunEndpointSummary | null
  metrics: RunMetric[]
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
