// Non-DOM logic for ServingProfilePicker.tsx: the three-way choice
// (accept the recommendation, pick another existing profile, or
// customise) and the customisation form's draft state.
import type {
  ServingProfileConfig,
  ServingProfileRecommendation,
  ServingProfileSelection,
  ServingProfileSummary,
} from '../../api/client'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'

export type ServingProfileChoice =
  | { kind: 'recommended' }
  | { kind: 'existing'; profileId: number | null }
  | { kind: 'customised'; draft: ServingProfileDraft }

// Every ServingProfileConfig field as a plain string, since that's what
// <input>/<select> bind to -- the OverrideEditor idiom. Unlike
// OverrideDraft, a blank field here is not "leave unchanged": this is a
// complete config, not a sparse delta, so every field needs a concrete
// value before it can be submitted (buildConfigFromDraft below returns
// null until it does). engine_options is carried through opaquely
// rather than rendered as editable inputs -- it is an escape hatch for
// uncommon engine flags (R-D6) that this wizard does not expose.
export interface ServingProfileDraft {
  engine: string
  engine_version: string
  gpus: string
  tensor_parallel_size: string
  pipeline_parallel_size: string
  max_model_len: string
  reasoning_parser: string
  dtype: string
  quantization: string
  gpu_memory_utilization: string
  engine_options: Record<string, string | number | boolean>
}

// Seeds a fresh customisation when nothing is selected yet -- 'vllm' is
// the only engine this system launches today (see
// docs/CHECKPOINT_REGISTRATION_PHASES.md Section 0.5), so it is a
// helpful starting point rather than a hidden requirement; the field
// stays a plain text input and the server does not assume it.
const DEFAULT_SERVING_PROFILE_CONFIG: ServingProfileConfig = {
  engine: 'vllm',
  engine_version: '',
  gpus: 1,
  tensor_parallel_size: 1,
  pipeline_parallel_size: 1,
  max_model_len: null,
  reasoning_parser: null,
  dtype: 'auto',
  quantization: null,
  gpu_memory_utilization: 0.9,
  engine_options: {},
}

export function draftFromProfile(config: ServingProfileConfig | null): ServingProfileDraft {
  const source = config ?? DEFAULT_SERVING_PROFILE_CONFIG
  return {
    engine: source.engine,
    engine_version: source.engine_version,
    gpus: String(source.gpus),
    tensor_parallel_size: String(source.tensor_parallel_size),
    pipeline_parallel_size: String(source.pipeline_parallel_size),
    max_model_len: source.max_model_len === null ? '' : String(source.max_model_len),
    reasoning_parser: source.reasoning_parser ?? '',
    dtype: source.dtype,
    quantization: source.quantization ?? '',
    gpu_memory_utilization: String(source.gpu_memory_utilization),
    engine_options: source.engine_options,
  }
}

function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === '') {
    return null
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function parseFloatOrNull(raw: string): number | null {
  if (raw.trim() === '') {
    return null
  }
  const parsed = Number.parseFloat(raw)
  return Number.isNaN(parsed) ? null : parsed
}

// Returns null while the draft is incomplete or has an unparsable
// number, which doubles as this form's validity check -- callers gate
// "Next" on the result being non-null rather than running a separate
// validation pass.
export function buildConfigFromDraft(draft: ServingProfileDraft): ServingProfileConfig | null {
  const engine = draft.engine.trim()
  const engineVersion = draft.engine_version.trim()
  const dtype = draft.dtype.trim()
  const gpus = parseIntOrNull(draft.gpus)
  const tensorParallelSize = parseIntOrNull(draft.tensor_parallel_size)
  const pipelineParallelSize = parseIntOrNull(draft.pipeline_parallel_size)
  const gpuMemoryUtilization = parseFloatOrNull(draft.gpu_memory_utilization)
  // max_model_len is optional (null = "no --max-model-len flag"), so a
  // blank field is valid; only a non-blank, unparsable one is not.
  const maxModelLenIsBlank = draft.max_model_len.trim() === ''
  const maxModelLen = maxModelLenIsBlank ? null : parseIntOrNull(draft.max_model_len)

  if (
    engine === '' ||
    engineVersion === '' ||
    dtype === '' ||
    gpus === null ||
    tensorParallelSize === null ||
    pipelineParallelSize === null ||
    gpuMemoryUtilization === null ||
    (!maxModelLenIsBlank && maxModelLen === null)
  ) {
    return null
  }

  return {
    engine,
    engine_version: engineVersion,
    gpus,
    tensor_parallel_size: tensorParallelSize,
    pipeline_parallel_size: pipelineParallelSize,
    max_model_len: maxModelLen,
    reasoning_parser: draft.reasoning_parser.trim() === '' ? null : draft.reasoning_parser.trim(),
    dtype,
    quantization: draft.quantization.trim() === '' ? null : draft.quantization.trim(),
    gpu_memory_utilization: gpuMemoryUtilization,
    engine_options: draft.engine_options,
  }
}

// The persisted profile a choice currently points to -- null for
// 'customised' (nothing persisted exists yet) or an 'existing' choice
// with nothing picked. Used both to render "what would be used" and to
// seed a customisation draft when the user switches into it.
export function resolveSelectedProfile(
  choice: ServingProfileChoice,
  recommendation: ServingProfileRecommendation,
  profiles: ServingProfileSummary[],
): ServingProfileSummary | null {
  if (choice.kind === 'recommended') {
    return recommendation.profile
  }
  if (choice.kind === 'existing') {
    return profiles.find((profile) => profile.id === choice.profileId) ?? null
  }
  return null
}

// The default choice once an inspection's recommendation is known:
// accept it if one exists, otherwise fall back to an explicit pick --
// R-T26 note: this is a plain function, not a hook, so a page can call
// it from a state initializer or an event handler without any
// rules-of-hooks concern.
export function defaultServingProfileChoice(
  recommendation: ServingProfileRecommendation,
): ServingProfileChoice {
  return recommendation.profile ? { kind: 'recommended' } : { kind: 'existing', profileId: null }
}

// The final POST /checkpoints payload fragment for whichever choice is
// active, or null while the choice can't yet resolve to one (nothing
// picked, or the customisation form is incomplete) -- the wizard uses
// this both to gate "Next" and to build the real request body, so the
// two can never disagree about what counts as ready.
export function buildServingProfileSelection(
  choice: ServingProfileChoice,
  recommendation: ServingProfileRecommendation,
): ServingProfileSelection | null {
  if (choice.kind === 'recommended') {
    return recommendation.profile ? { existing_profile_id: recommendation.profile.id } : null
  }
  if (choice.kind === 'existing') {
    return choice.profileId === null ? null : { existing_profile_id: choice.profileId }
  }
  const config = buildConfigFromDraft(choice.draft)
  return config === null ? null : { customised: config }
}

// A one-line "what this profile actually does" for the accept/pick
// options -- the fields a human uses to tell profiles apart at a
// glance, mirroring ServingProfileSummary's own docstring framing.
export function describeProfileGlance(profile: ServingProfileSummary): string {
  const parts = [
    servingProfileDisplayName(profile.label, profile.hash),
    `${profile.engine} ${profile.engine_version}`,
    `${profile.gpus} GPU${profile.gpus === 1 ? '' : 's'}`,
  ]
  if (profile.max_model_len !== null) {
    parts.push(`max_model_len ${profile.max_model_len.toLocaleString()}`)
  }
  if (profile.reasoning_parser !== null) {
    parts.push(`reasoning_parser ${profile.reasoning_parser}`)
  }
  return parts.join(' · ')
}
