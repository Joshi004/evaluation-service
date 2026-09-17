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
  // The id itself -- Submit's per-checkpoint serving card looks this
  // checkpoint's own default profile up in the already-fetched
  // serving-profiles list by this id, the same reason
  // default_sampling_profile_id exists below.
  default_serving_profile_id: number
  // Joined in from sampling_profile, same reasoning -- named with the
  // default_ prefix (unlike serving_profile_label/_hash above) because
  // docs/STANDARDS_AND_PROFILES_PHASES.md Phase 2 names it explicitly.
  default_sampling_profile_label: string | null
  default_sampling_profile_hash: string
  // The id itself -- Submit's per-checkpoint sampling card looks this
  // checkpoint's own default profile up in the already-fetched
  // sampling-profiles list by this id.
  default_sampling_profile_id: number
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
  standard_id: number
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
// key set.
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
  // Blocking, unlike `problems` above: registration refuses a candidate
  // whenever this is non-empty.
  missing_requirements: string[]
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

// One (checkpoint, comparison_hash) pair with its most recent finished
// primary metric -- see app/schemas/leaderboard.py. `comparison_hash` is
// what the leaderboard actually groups by (docs/STANDARDS_AND_PROFILES_PHASES.md
// Phase 3, S-D5): two rows only collapse to one cell if they share both
// the standard and the resolved sampling profile, not just the
// standard. Pivoting these into a grid is LeaderboardPage.helper.ts's
// job, not this type's.
export interface LeaderboardRow {
  checkpoint_id: number
  // The specific eval_run this row's metric came from -- what lets a
  // leaderboard cell link straight to its run page
  // (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 1).
  eval_run_id: number
  standard_id: number
  benchmark: string
  standard_hash: string
  label: string | null
  comparison_hash: string
  sampling_profile_label: string | null
  // label is null for an ad-hoc sampling profile -- the hash is what
  // still tells two such columns for the same benchmark apart once the
  // pivot keys on comparison_hash (Phase 8).
  sampling_profile_hash: string
  metric_name: string
  metric_value: number
  n_samples: number | null
  truncation_rate: number | null
  finished_at: string
}

// Catalog status wire shapes (docs/STANDARDS_AND_PROFILES_PHASES.md
// Section 0.5 and Phase 6's app/schemas/catalog.py) -- shared by all
// three catalogs (standards, sampling profiles, serving profiles).
// `state` mirrors that schema's CatalogEntryState exactly; `detail`
// already carries Phase 6's deletion blockers folded in by
// annotate_deletability, so the frontend never computes them itself.
export type CatalogEntryState = 'loaded' | 'new' | 'conflicting' | 'orphaned' | 'ad_hoc' | 'invalid'

// One line of a GET /{resource}/catalog-status report -- a YAML file, a
// database row, or (the loaded/conflicting states) both at once
// referring to each other. `file`/`row_id`/`row_hash` are null
// depending on `state`: a `new` or `invalid` entry has no row yet; an
// `orphaned` or `ad_hoc` row has no file.
export interface CatalogEntryStatus {
  file: string | null
  label: string | null
  row_id: number | null
  row_hash: string | null
  state: CatalogEntryState
  detail: string | null
  deletable: boolean
}

// GET /{resource}/catalog-status's full response -- what a reload would
// do to every file, plus every row a reload would leave untouched
// (orphaned, ad-hoc), in one call.
export interface CatalogStatus {
  catalog: string
  entries: CatalogEntryStatus[]
}

// POST /{resource}/prune's response -- every id actually removed, not a
// bare count, so the caller can show exactly what went (S-D31).
export interface CatalogPruneResult {
  deleted_ids: number[]
}

// A sampling field whose value is recorded but has no effect under a
// given framework -- e.g. a non-zero min_p under evalscope (decision
// D4). Computed by the backend, not stored. Renamed from
// RecipeFieldWarning in docs/STANDARDS_AND_PROFILES_PHASES.md Phase 3:
// every warning it carries is about a sampling field, whichever table
// (standard or sampling profile) the value it's warning about came
// from.
export interface SamplingFieldWarning {
  field: string
  message: string
}

// One entry of a standard's `metrics` array -- unlike `extraction`
// below, this has a fixed, strictly-validated shape
// (app/schemas/standards.py's StandardMetricDefinition), so it's typed
// here rather than left as unknown.
export interface StandardMetricDefinition {
  name: string
  display_name: string
  harness_key: string
  higher_is_better: boolean
  is_primary: boolean
}

// One row from `standard` where `label IS NOT NULL` (the default) or
// every row when the caller asks `GET /standards?include_ad_hoc=true`
// -- see app/schemas/standards.py's StandardSummary. `label` is null
// only for an ad-hoc row, which only `include_ad_hoc=true` ever
// returns; every page today calls the endpoint without that flag, so in
// practice this is always a reviewed standard. `extraction` stays
// untyped-shape (`unknown`, never `any`) since that DB column is
// genuinely shapeless per benchmark. `source_yaml` is the standard's own
// YAML file, read verbatim -- comments included -- rather than parsed
// into per-field sources; it's null for an ad-hoc row, which was never
// loaded from a file.
export interface StandardSummary {
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
  train_split: string | null
  few_shot: number
  prompt_template: string
  few_shot_prompt_template: string | null
  extraction: Record<string, unknown>
  metrics: StandardMetricDefinition[]
  repeats: number
  sample_limit: number | null
  think_handling: string
  // What this standard's own published definition mandates about
  // sampling (S-D4's second merge layer) -- most standards mandate
  // nothing, so this is `{}` far more often than not. A sparse subset
  // of SamplingProfileConfig's nine keys, validated against that same
  // field set at load time (S-D22).
  sampling_overrides: Record<string, unknown>
  // Which samples run -- hashed, so a standard like tau2_retail is
  // distinguished from tau2_telecom by this field alone (Phase 4).
  subsets: string[]
  // Operational, not hashed (S-D7): throughput and per-request timeout,
  // never part of what the standard measures.
  eval_batch_size: number
  request_timeout_seconds: number
  created_at: string
  warnings: SamplingFieldWarning[]
  source_yaml: string | null
}

// One eval_run row, enriched server-side with the names a human needs
// to read it without a second round trip -- see app/schemas/runs.py's
// RunListItem. standard_label falls back to null for an unlabelled
// override, in which case standard_hash is what identifies it.
export interface RunListItem {
  id: number
  run_group_id: number
  run_group_name: string
  checkpoint_id: number
  checkpoint_name: string
  standard_id: number
  standard_label: string | null
  standard_hash: string
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

// A user override of a base standard's protocol fields -- see
// app/schemas/runs.py's StandardOverrides. Every field is optional and
// nullable: a key left out entirely means "don't touch this field" (the
// backend's `exclude_unset=True`), while a key present with `null` is
// itself an override -- dataset_revision, split and sample_limit are
// legitimately nullable. Only include a key here once the caller has
// actually set it. Narrowed in docs/STANDARDS_AND_PROFILES_PHASES.md
// Phase 3 to the fields that stayed on `standard` once sampling moved
// to SamplingOverrides below.
export interface StandardOverrides {
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
  think_handling?: string | null
}

// A user override of a resolved sampling profile's fields -- see
// app/schemas/runs.py's SamplingOverrides, the third and last layer of
// S-D4's merge (the checkpoint's own default or an explicitly picked
// sampling_profile_id, then the standard's sampling_overrides, then
// this). Mirrors StandardOverrides' same optional/nullable discipline,
// over SamplingProfileConfig's nine fields.
export interface SamplingOverrides {
  temperature?: number | null
  top_p?: number | null
  top_k?: number | null
  min_p?: number | null
  presence_penalty?: number | null
  repetition_penalty?: number | null
  max_tokens?: number | null
  enable_thinking?: boolean | null
  seed?: number | null
}

// A user override of a resolved serving profile's fields -- see
// app/schemas/runs.py's ServingOverrides, the submit-time analogue of
// SamplingOverrides. Only the eight fields that actually change how the
// engine launches -- engine, engine_version and engine_options are
// excluded because the cluster's serve script pins the vLLM binary
// itself, so overriding those would move this override's hash without
// moving what launch actually runs.
export interface ServingOverrides {
  gpus?: number | null
  tensor_parallel_size?: number | null
  pipeline_parallel_size?: number | null
  max_model_len?: number | null
  reasoning_parser?: string | null
  dtype?: string | null
  quantization?: string | null
  gpu_memory_utilization?: number | null
}

// POST /api/v1/runs body -- every (checkpoint, standard) pair in the
// cartesian product of checkpoint_ids x standard_ids becomes one queued
// run, all sharing one new run_group.
//
// Overrides are keyed per-axis, not one grid-wide value each -- see
// app/schemas/runs.py's CreateRunsRequest: a standard's shape belongs
// to that standard alone, and a sampling override or an explicit
// profile choice belongs to that checkpoint alone. A checkpoint id
// absent from sampling_profile_id_by_checkpoint_id falls back to that
// checkpoint's own default_sampling_profile_id (S-D9). Keys must be a
// subset of standard_ids / checkpoint_ids respectively, or the backend
// 422s.
export interface CreateRunsRequest {
  name: string
  checkpoint_ids: number[]
  standard_ids: number[]
  standard_overrides_by_standard_id: Record<number, StandardOverrides>
  sampling_overrides_by_checkpoint_id: Record<number, SamplingOverrides>
  sampling_profile_id_by_checkpoint_id: Record<number, number>
  serving_overrides_by_checkpoint_id: Record<number, ServingOverrides>
  serving_profile_id_by_checkpoint_id: Record<number, number>
  // Applied to whichever row this submit actually mints for that id --
  // a hash hit reuses an existing row untouched, so a label here only
  // ever attaches to a brand new row. Omit a key, never send `''`: the
  // backend rejects an empty label with a 422 (it would only ever be a
  // bug, never a real name).
  standard_label_by_standard_id: Record<number, string>
  sampling_label_by_checkpoint_id: Record<number, string>
  serving_label_by_checkpoint_id: Record<number, string>
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

// POST /api/v1/runs/preview body -- the same grid shape and the same
// per-axis override maps as CreateRunsRequest above, minus `name` and
// `submitted_by`.
export interface RunPreviewRequest {
  checkpoint_ids: number[]
  standard_ids: number[]
  standard_overrides_by_standard_id: Record<number, StandardOverrides>
  sampling_overrides_by_checkpoint_id: Record<number, SamplingOverrides>
  sampling_profile_id_by_checkpoint_id: Record<number, number>
  serving_overrides_by_checkpoint_id: Record<number, ServingOverrides>
  serving_profile_id_by_checkpoint_id: Record<number, number>
}

// One compatibility rule's result -- see app/schemas/compatibility.py's
// CompatibilityFinding. No `severity` field: which list a finding is in
// (errors vs warnings, below) is what determines that.
export interface CompatibilityFinding {
  code: string
  field: string
  message: string
}

// One (checkpoint, standard) cell of the grid a submit would create.
// errors/warnings are the exact findings POST /runs would 400 on for
// this pair -- computed by the same backend functions that raise it, so
// this and a real submit can never disagree about what a value does.
export interface RunPreviewPair {
  checkpoint_id: number
  checkpoint_name: string
  standard_id: number
  standard_label: string | null
  benchmark: string
  errors: CompatibilityFinding[]
  warnings: CompatibilityFinding[]
  // What this pair's run would actually be grouped under on the
  // leaderboard (S-D5) -- shown before the run, not only discovered on
  // the leaderboard afterwards (docs/STANDARDS_AND_PROFILES_PHASES.md
  // Phase 8).
  comparison_hash: string
}

// One field an override would change from its base value -- equally
// usable for a standard's protocol fields and a sampling profile's
// fields, since both are just "a base config, merged with overrides".
// base_value/override_value are `unknown`, not `any` -- a field's value
// is genuinely dynamic across fields (a number for temperature, an
// object for extraction), so the caller has to narrow before using
// either.
export interface FieldChange {
  field: string
  base_value: unknown
  override_value: unknown
}

// What resolve_standard would do for one base standard plus the
// submit's protocol overrides, without actually doing it -- see
// app/services/runs/preview.py.
export interface ResolvedStandardPreview {
  base_standard_id: number
  hash: string
  is_new_standard: boolean
  changed_fields: FieldChange[]
}

// What resolve_sampling_profile would do for one (checkpoint, standard)
// pair, without actually doing it -- mirrors ResolvedStandardPreview,
// but keyed by a pair rather than a base standard alone: the merge's
// first layer (the checkpoint's own default, or an explicitly picked
// profile) and its second layer (the standard's sampling_overrides)
// both vary per pair, so the same submit-level override can resolve to
// a different profile for every cell of the grid.
export interface ResolvedSamplingPreview {
  checkpoint_id: number
  standard_id: number
  base_sampling_profile_id: number
  hash: string
  is_new_sampling_profile: boolean
  changed_fields: FieldChange[]
  warnings: SamplingFieldWarning[]
}

// What resolve_serving_profile would do for one checkpoint's serving
// override, without actually doing it -- mirrors ResolvedStandardPreview,
// but keyed by checkpoint_id alone rather than a pair: nothing about a
// standard feeds into serving, so one checkpoint resolves to exactly one
// serving profile regardless of which standards are selected alongside
// it. `gpus` is carried here (not just inside changed_fields) because
// RunPreview.gpu_count below is summed over exactly these resolved
// profiles -- a gpus override must move the number shown before submit.
export interface ResolvedServingPreview {
  checkpoint_id: number
  base_serving_profile_id: number
  hash: string
  is_new_serving_profile: boolean
  changed_fields: FieldChange[]
  gpus: number
}

// Response for POST /api/v1/runs/preview -- everything the Submit page
// needs to render before anything POSTs.
export interface RunPreview {
  run_count: number
  gpu_count: number
  pairs: RunPreviewPair[]
  resolved_standards: ResolvedStandardPreview[]
  resolved_sampling: ResolvedSamplingPreview[]
  resolved_serving: ResolvedServingPreview[]
}

export interface RunMetric {
  name: string
  value: number
  n_samples: number | null
  is_primary: boolean
}

// The harness's own rendering hint for one metric -- read from
// results_json["metrics"][i]["semantics"] on the backend
// (app/schemas/diagnostics.py's MetricDisplay). What lets a benchmark
// that reports seconds or tokens-per-second render correctly with no
// frontend change, instead of every page hardcoding percent formatting.
export interface MetricDisplay {
  display_kind: string
  display_multiplier: number | null
  display_unit: string | null
  display_precision: number
  direction: string
}

// A 95% Wilson interval over a pass-rate metric's value and n_samples --
// only set on a metric that is a genuine per-sample pass rate. See
// MetricPerformance.confidence_interval below.
export interface ConfidenceInterval {
  lower: number
  upper: number
}

// One of the run's metric rows, enriched with a pass count, a
// confidence interval, and a display hint (app/schemas/diagnostics.py's
// MetricPerformance). `passed`/`failed`/`confidence_interval` are null
// for every non-primary metric -- IFEval/IFBench's inst_level_* metrics
// are a macro average of each sample's own pass ratio, not a pooled
// pass/fail count, so deriving a count from one would count
// instructions that were never separately tallied.
export interface MetricPerformance {
  name: string
  display_name: string
  value: number
  n_samples: number | null
  is_primary: boolean
  passed: number | null
  failed: number | null
  confidence_interval: ConfidenceInterval | null
  display: MetricDisplay | null
}

// results_json["perf_metrics"]["summary"]["latency"] -- the five
// percentiles the run page's health line shows.
export interface LatencySeconds {
  mean: number
  p50: number
  p90: number
  p99: number
  max: number
}

// results_json["perf_metrics"]["summary"]["usage"]["output_tokens"]
// plus the run-wide total from usage.total_output_tokens.
export interface OutputTokens {
  mean: number
  max: number
  total: number
}

// results_json["perf_metrics"]["summary"]["throughput"].
export interface Throughput {
  output_tokens_per_second: number
  requests_per_second: number
}

// RunDetail.performance -- null for a queued, running, failed or
// cancelled run (no results_json yet). Computed entirely from data
// already in Postgres (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase
// 1); rendered by RunHealthBand.
export interface RunPerformanceSummary {
  n_samples: number | null
  primary_metric_name: string | null
  metrics: MetricPerformance[]
  latency_seconds: LatencySeconds | null
  output_tokens: OutputTokens | null
  throughput: Throughput | null
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

// The fully resolved standard a run actually used -- the same fields as
// StandardSummary minus source_yaml (which only exists for a reviewed
// standard, not an ad-hoc override) and warnings (moved to
// RunSamplingDetail below -- a D4 warning is about a sampling field,
// and the run's resolved sampling profile, not this standard's bare
// sampling_overrides, is the complete picture of what the run actually
// asked the model to do).
export interface RunStandardDetail {
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
  train_split: string | null
  few_shot: number
  prompt_template: string
  few_shot_prompt_template: string | null
  extraction: Record<string, unknown>
  metrics: StandardMetricDefinition[]
  repeats: number
  sample_limit: number | null
  think_handling: string
  sampling_overrides: Record<string, unknown>
  subsets: string[]
  eval_batch_size: number
  request_timeout_seconds: number
  created_at: string
}

// The fully resolved sampling profile a run actually used -- every
// field that can change how the model was asked to speak, plus decision
// D4's per-field warnings computed against the run's standard's
// framework (the same warnings the Standards page and the Submit
// preview also use, so a run's own page never disagrees with either).
export interface RunSamplingDetail {
  id: number
  hash: string
  label: string | null
  temperature: number
  top_p: number
  top_k: number
  min_p: number
  presence_penalty: number
  repetition_penalty: number
  max_tokens: number
  enable_thinking: boolean
  seed: number
  warnings: SamplingFieldWarning[]
}

// GET /api/v1/runs/{id} -- the full row (RunListItem) plus what a human
// reads to actually understand what happened: the resolved standard,
// sampling profile and serving profile, the comparison_hash they
// produced (S-D5 -- what the leaderboard groups by), the endpoint it
// ran against (or null if it never got one -- Phase 5's known
// cancel-before-endpoint gap), its output directory, and its metric
// rows. `serving` is the run's own recorded profile (S-T12), not
// necessarily the checkpoint's current default -- reuses
// ServingProfileSummary rather than a fourth resolved-detail type,
// since nothing about a serving profile's shape changes for the run
// context.
export interface RunDetail extends RunListItem {
  output_dir: string | null
  comparison_hash: string
  standard: RunStandardDetail
  sampling: RunSamplingDetail
  serving: ServingProfileSummary
  endpoint: RunEndpointSummary | null
  metrics: RunMetric[]
  performance: RunPerformanceSummary | null
}

// --- Phase 3 of docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md: the
// diagnostics API -------------------------------------------------------
//
// Everything below mirrors app/schemas/diagnostics.py field for field.
// Layer 4 (RunDiagnosticsPage, Phase 4) is the first page to read these.

// One of DiagnosticsSummary.metrics -- mirrors DiagnosticsMetric.
// `passed` is null for a macro-averaged metric (e.g. IFEval's
// inst_level_strict), same rule as MetricPerformance.passed above.
export interface DiagnosticsMetric {
  name: string
  display_name: string
  value: number
  n_samples: number
  passed: number | null
}

// One subset's counts -- mirrors DiagnosticsSubset. IFEval has exactly
// one subset ("default"); MMLU-Pro has 14, including one with a space
// in its name ("computer science").
export interface DiagnosticsSubset {
  name: string
  n_samples: number
  passed: number
}

// Mirrors DiagnosticsHealth. Reuses LatencySeconds/OutputTokens above
// field-for-field, the same reuse the backend schema documents.
export interface DiagnosticsHealth {
  truncated: number
  empty_answers: number
  errored_requests: number
  latency_seconds: LatencySeconds | null
  output_tokens: OutputTokens | null
}

// Mirrors DiagnosticsInstructionLevel (Phase 5). Reconciles the
// harness's own macro-averaged instruction-level score against the
// pooled (micro) view a bucket breakdown necessarily is -- `null` for
// a benchmark with no instruction-level metrics at all (GSM8K,
// GPQA-Diamond, MMLU-Pro). `recheck_passed` is `null` when the recheck
// never ran for this run, and is expected to differ from
// `micro_passed` by a couple of samples even when it did (decision
// 4's two random-letter samples, never reconciled).
export interface DiagnosticsInstructionLevel {
  macro_metric_name: string
  macro_value: number
  micro_value: number
  micro_passed: number
  micro_total: number
  recheck_passed: number | null
}

// Mirrors DiagnosticsTagCount (Phase 8) -- how many failing samples
// carry each tag, sorted by count descending then tag name ascending.
export interface DiagnosticsTagCount {
  tag: string
  n_samples: number
}

// Mirrors DiagnosticsSummary. `tag_counts`/`narrative` are Phase 8's
// failure tags and deterministic written summary -- `narrative` still
// carries one "All N samples passed." sentence even for a run with no
// failures, so it is never empty once a Phase 8 build has run.
export interface DiagnosticsSummary {
  n_samples: number
  primary_metric_name: string
  primary_metric_display_name: string
  passed: number
  failed: number
  metrics: DiagnosticsMetric[]
  health: DiagnosticsHealth
  subsets: DiagnosticsSubset[]
  instruction_level: DiagnosticsInstructionLevel | null
  tag_counts: DiagnosticsTagCount[]
  narrative: string[]
}

// Mirrors DiagnosticsSource.
export interface DiagnosticsSource {
  eval_run_id: number
  benchmark: string
  task_name: string
  served_model_name: string
  harness_image: string
  reviews_files: string[]
}

// One row of Layer 3's breakdown table -- mirrors DiagnosticsBucket
// (Phase 5). `level` distinguishes which table a row belongs to
// ("family" or "rule" for IFEval/IFBench; "subject" for MMLU-Pro).
// `passed`/`pass_rate` are `null` when the only thing known is which
// instructions exist in this bucket, not how many passed -- a failed
// recheck still produces buckets from `instruction_id_list` alone,
// with per-rule detail marked unavailable rather than guessed at.
export interface DiagnosticsBucket {
  name: string
  level: string
  n_instructions: number
  passed: number | null
  pass_rate: number | null
}

// GET /runs/{id}/diagnostics and the rebuild endpoint's response --
// summary and buckets, deliberately with no samples array (Section
// 3.5 of the phases doc).
export interface RunDiagnostics {
  schema_version: number
  generated_at: string
  source: DiagnosticsSource
  summary: DiagnosticsSummary
  buckets: DiagnosticsBucket[]
}

// One of summary.samples -- mirrors DiagnosticsSample field for field.
// `benchmark_details` stays opaque here too: only a benchmark module
// and the Layer 5 renderer (both later phases) look inside it.
export interface DiagnosticsSample {
  sample_key: string
  index: number
  subset: string
  passed: boolean
  scores: Record<string, number>
  input_preview: string
  output_preview: string
  target: string
  tokens_in: number | null
  tokens_out: number | null
  latency_seconds: number | null
  stop_reason: string | null
  has_reasoning: boolean
  tags: string[]
  benchmark_details: Record<string, unknown>
}

// GET /runs/{id}/samples -- `total` is the count after filtering,
// before paging (Section 3.5), so a caller pages through exactly what
// `total` promises.
export interface SamplePage {
  total: number
  items: DiagnosticsSample[]
}

// --- Phase 7 of docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md: the sample
// detail page ---------------------------------------------------------
//
// Mirrors app/schemas/diagnostics.py field for field, same as the
// Phase 3 block above.

// Mirrors RuleCheck. `strict`/`loose` are null when the sample's own
// rule_results was never filled in (a recheck that failed, or a
// benchmark without one) -- the checklist still lists every rule,
// just without ticks.
export interface RuleCheck {
  rule_id: string
  description: string
  strict: boolean | null
  loose: boolean | null
}

// Mirrors SampleText. Read from the reviews file on demand, by index
// -- never part of the diagnostics file itself (Section 3.2), so this
// only ever arrives on DiagnosticsSampleDetail, not DiagnosticsSample.
export interface SampleText {
  prompt: string
  answer: string
  reasoning: string
  target: string
  extracted_prediction: string
  explanation: string | null
}

// GET /runs/{id}/samples/{sample_key}'s real response shape -- every
// field DiagnosticsSample already carries, plus the full text and,
// for IFEval/IFBench, the per-rule checklist. `rules` is `[]` for
// every benchmark without one (Section 3.4), not null -- same "empty
// means nothing to show" convention as RunDiagnostics.buckets.
export interface DiagnosticsSampleDetail extends DiagnosticsSample {
  text: SampleText | null
  rules: RuleCheck[]
}

// --- Phase 9 of docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md: the compare
// page ------------------------------------------------------------------
//
// Mirrors app/schemas/diagnostics.py's own Phase 9 block field for field.

// One run's own identity and primary score, as shown on its own score
// card. Mirrors ComparisonSide -- confidence_interval reuses the same
// Wilson interval shape MetricPerformance already carries.
export interface ComparisonSide {
  eval_run_id: number
  benchmark: string
  served_model_name: string
  primary_metric_name: string
  primary_metric_display_name: string
  value: number
  n_samples: number
  passed: number
  failed: number
  confidence_interval: ConfidenceInterval | null
}

// How much of each run's own sample set the join actually covers --
// mirrors ComparisonOverlap. Populated even on a refusal, so a refused
// comparison still says why instead of just stopping.
export interface ComparisonOverlap {
  n_shared: number
  left_only: number
  right_only: number
}

// Mirrors ComparisonDelta. `value` is right.value - left.value;
// `is_significant` is the two-proportion test against both runs' own
// Wilson half-widths combined in quadrature, not a simple
// interval-overlap check.
export interface ComparisonDelta {
  value: number
  combined_half_width: number
  is_significant: boolean
}

// One row of a flip list -- mirrors FlipSample. `subset`/`input_preview`
// come from the left run's own record (identical on the right for any
// sample sharing a sample_key); `left_score`/`right_score` are each
// side's own primary-metric value, almost always 0.0 or 1.0.
export interface FlipSample {
  sample_key: string
  subset: string
  input_preview: string
  left_output_preview: string
  right_output_preview: string
  left_score: number | null
  right_score: number | null
}

// One row of the bucket-delta table -- mirrors ComparisonBucketDelta, a
// full outer join on (level, name) across both runs' own buckets.
// Per-side fields are null when that bucket doesn't exist on that side
// at all, never guessed at.
export interface ComparisonBucketDelta {
  name: string
  level: string
  left_n_instructions: number | null
  left_passed: number | null
  left_pass_rate: number | null
  right_n_instructions: number | null
  right_passed: number | null
  right_pass_rate: number | null
  pass_rate_delta: number | null
}

// GET /runs/{run_id}/compare/{other_run_id}'s response -- mirrors
// RunComparison. comparable=false means delta is null and both flip
// lists are [] -- refusal_reason is the plain-English reason why
// (different benchmarks, or too little sample-key overlap), and
// overlap is still populated either way.
export interface RunComparison {
  left: ComparisonSide
  right: ComparisonSide
  overlap: ComparisonOverlap
  comparable: boolean
  refusal_reason: string | null
  delta: ComparisonDelta | null
  fail_to_pass: FlipSample[]
  pass_to_fail: FlipSample[]
  unchanged_passed: number
  unchanged_failed: number
  bucket_deltas: ComparisonBucketDelta[]
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

// A plain Error carries no status, so a "clear not-found state"
// (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 7) would otherwise
// mean string-matching FastAPI's own detail text (e.g. "Run or sample
// not found"). Every existing apiFetch caller is unaffected --
// ApiError extends Error, and String(error) still renders the same
// message it always has.
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    throw new ApiError(
      extractErrorDetail(body) ?? `${init?.method ?? 'GET'} ${path} failed with ${response.status}`,
      response.status,
    )
  }
  // DELETE /endpoints/:id returns 204 with no body -- .json() would
  // throw on the empty response.
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
