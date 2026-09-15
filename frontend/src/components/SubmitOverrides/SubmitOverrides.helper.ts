// Non-DOM logic for SubmitOverrides.tsx and the three per-axis cards it
// renders (CheckpointSamplingCard, CheckpointServingCard,
// StandardOverrideCard): draft state for every override field, kept as
// a plain string the same way OverrideEditor.helper.ts (removed by this
// change) used to -- that's what <input>/<select> bind to, and it's
// what lets a blank field mean "leave this alone" rather than "zero" or
// "false".
//
// Overrides are keyed per-axis rather than one flat draft for the whole
// grid: a standard's shape (sample_limit, few_shot, repeats,
// think_handling) belongs to that standard alone, a checkpoint's
// sampling (the eight SamplingOverrides fields, plus which base profile
// it starts from) belongs to that checkpoint alone, and a checkpoint's
// serving (the eight ServingOverrides fields, plus its own base
// profile) belongs to that checkpoint alone too -- see
// app/schemas/runs.py's CreateRunsRequest for why a single grid-wide
// value of any of these was ambiguous the moment more than one
// checkpoint or standard was selected.
//
// A field left blank in a draft must end up entirely absent from the
// resulting overrides object, not present with some default value --
// see app/schemas/runs.py's StandardOverrides/SamplingOverrides/
// ServingOverrides docstrings on why the backend (Pydantic's
// exclude_unset) needs "the key is absent" and "the key is present" to
// stay distinguishable.
//
// Each axis also carries its own label draft: `string | null`, where an
// absent entry (accessor returns `null`) means "untouched" -- the
// caller renders and, at submit time, sends whatever suggestion
// SubmitOverrides.tsx computed for it -- an entry present with `''`
// means explicitly unlabelled (today's behaviour, unaffected by this
// change), and anything else is the caller's own name. Resolving
// "untouched" into an actual suggestion needs the catalog's taken
// labels and every other card's own claim, neither of which this file
// has, so that step -- and the collision-free accumulation across
// cards -- lives in SubmitOverrides.tsx; buildRequestOverrides below
// only ever carries an already-resolved label through to the wire.

import type {
  CheckpointListItem,
  SamplingOverrides,
  SamplingProfileSummary,
  ServingOverrides,
  ServingProfileSummary,
  StandardOverrides,
  StandardSummary,
} from '../../api/client'
import { resolveBaseSamplingProfile } from '../CheckpointSamplingCard/CheckpointSamplingCard.helper'
import { resolveBaseServingProfile } from '../CheckpointServingCard/CheckpointServingCard.helper'
import { suggestNextLabel } from '../../utils/suggestNextLabel'

export interface StandardOverrideDraft {
  sample_limit: string
  few_shot: string
  repeats: string
  think_handling: '' | 'strip' | 'as_is'
}

export interface SamplingOverrideDraft {
  temperature: string
  top_p: string
  top_k: string
  min_p: string
  presence_penalty: string
  repetition_penalty: string
  max_tokens: string
  enable_thinking: '' | 'true' | 'false'
}

// The eight ServingOverrides fields as plain strings, all free text
// (not a closed select) for reasoning_parser/dtype/quantization --
// mirrors the registration wizard's own customisation form
// (ServingProfilePicker.helper.ts's ServingProfileDraft), which treats
// those three the same way rather than offering a fixed option set.
export interface ServingOverrideDraft {
  gpus: string
  tensor_parallel_size: string
  pipeline_parallel_size: string
  max_model_len: string
  reasoning_parser: string
  dtype: string
  quantization: string
  gpu_memory_utilization: string
}

export const EMPTY_STANDARD_OVERRIDE_DRAFT: StandardOverrideDraft = {
  sample_limit: '',
  few_shot: '',
  repeats: '',
  think_handling: '',
}

export const EMPTY_SAMPLING_OVERRIDE_DRAFT: SamplingOverrideDraft = {
  temperature: '',
  top_p: '',
  top_k: '',
  min_p: '',
  presence_penalty: '',
  repetition_penalty: '',
  max_tokens: '',
  enable_thinking: '',
}

export const EMPTY_SERVING_OVERRIDE_DRAFT: ServingOverrideDraft = {
  gpus: '',
  tensor_parallel_size: '',
  pipeline_parallel_size: '',
  max_model_len: '',
  reasoning_parser: '',
  dtype: '',
  quantization: '',
  gpu_memory_utilization: '',
}

// Every selected standard's and checkpoint's own draft, plus which base
// profile a checkpoint starts from if not its registered default
// (S-D35's per-checkpoint choice) on both the sampling and serving
// axes, plus a label draft per axis. An id absent from a draft or
// profile-choice map simply hasn't been typed into yet -- see
// standardDraftFor / samplingDraftFor / servingDraftFor and the label
// accessors below for the fallback each gives.
export interface SubmitOverrideDrafts {
  standardDraftsByStandardId: Record<number, StandardOverrideDraft>
  samplingDraftsByCheckpointId: Record<number, SamplingOverrideDraft>
  samplingProfileIdByCheckpointId: Record<number, number>
  servingDraftsByCheckpointId: Record<number, ServingOverrideDraft>
  servingProfileIdByCheckpointId: Record<number, number>
  standardLabelByStandardId: Record<number, string>
  samplingLabelByCheckpointId: Record<number, string>
  servingLabelByCheckpointId: Record<number, string>
}

export const EMPTY_SUBMIT_OVERRIDE_DRAFTS: SubmitOverrideDrafts = {
  standardDraftsByStandardId: {},
  samplingDraftsByCheckpointId: {},
  samplingProfileIdByCheckpointId: {},
  servingDraftsByCheckpointId: {},
  servingProfileIdByCheckpointId: {},
  standardLabelByStandardId: {},
  samplingLabelByCheckpointId: {},
  servingLabelByCheckpointId: {},
}

export function standardDraftFor(
  drafts: SubmitOverrideDrafts,
  standardId: number,
): StandardOverrideDraft {
  return drafts.standardDraftsByStandardId[standardId] ?? EMPTY_STANDARD_OVERRIDE_DRAFT
}

export function samplingDraftFor(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
): SamplingOverrideDraft {
  return drafts.samplingDraftsByCheckpointId[checkpointId] ?? EMPTY_SAMPLING_OVERRIDE_DRAFT
}

export function servingDraftFor(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
): ServingOverrideDraft {
  return drafts.servingDraftsByCheckpointId[checkpointId] ?? EMPTY_SERVING_OVERRIDE_DRAFT
}

// `null` means untouched -- see this file's header comment on why that
// is the state SubmitOverrides.tsx fills in with a computed suggestion,
// rather than something resolved here.
export function standardLabelDraftFor(drafts: SubmitOverrideDrafts, standardId: number): string | null {
  return drafts.standardLabelByStandardId[standardId] ?? null
}

export function samplingLabelDraftFor(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
): string | null {
  return drafts.samplingLabelByCheckpointId[checkpointId] ?? null
}

export function servingLabelDraftFor(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
): string | null {
  return drafts.servingLabelByCheckpointId[checkpointId] ?? null
}

// Immutable updaters -- SubmitOverrides.tsx passes one of these,
// partially applied to the id it's already rendering, down to each
// card as that card's whole `onDraftChange`/`onProfileChoiceChange`/
// `onLabelChange`, so a card never has to know it's really updating one
// entry of a bigger record.
export function withStandardDraft(
  drafts: SubmitOverrideDrafts,
  standardId: number,
  draft: StandardOverrideDraft,
): SubmitOverrideDrafts {
  return {
    ...drafts,
    standardDraftsByStandardId: { ...drafts.standardDraftsByStandardId, [standardId]: draft },
  }
}

export function withSamplingDraft(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
  draft: SamplingOverrideDraft,
): SubmitOverrideDrafts {
  return {
    ...drafts,
    samplingDraftsByCheckpointId: { ...drafts.samplingDraftsByCheckpointId, [checkpointId]: draft },
  }
}

export function withServingDraft(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
  draft: ServingOverrideDraft,
): SubmitOverrideDrafts {
  return {
    ...drafts,
    servingDraftsByCheckpointId: { ...drafts.servingDraftsByCheckpointId, [checkpointId]: draft },
  }
}

// `profileId === null` clears the entry rather than storing it -- an
// absent key is what falls back to the checkpoint's own
// default_sampling_profile_id (S-D9); storing `null` would mean two
// different keyed-out states.
export function withSamplingProfileChoice(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
  profileId: number | null,
): SubmitOverrideDrafts {
  const samplingProfileIdByCheckpointId = { ...drafts.samplingProfileIdByCheckpointId }
  if (profileId === null) {
    delete samplingProfileIdByCheckpointId[checkpointId]
  } else {
    samplingProfileIdByCheckpointId[checkpointId] = profileId
  }
  return { ...drafts, samplingProfileIdByCheckpointId }
}

// Mirrors withSamplingProfileChoice exactly, one profile axis over --
// an absent key falls back to the checkpoint's own
// default_serving_profile_id.
export function withServingProfileChoice(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
  profileId: number | null,
): SubmitOverrideDrafts {
  const servingProfileIdByCheckpointId = { ...drafts.servingProfileIdByCheckpointId }
  if (profileId === null) {
    delete servingProfileIdByCheckpointId[checkpointId]
  } else {
    servingProfileIdByCheckpointId[checkpointId] = profileId
  }
  return { ...drafts, servingProfileIdByCheckpointId }
}

export function withStandardLabel(
  drafts: SubmitOverrideDrafts,
  standardId: number,
  label: string,
): SubmitOverrideDrafts {
  return {
    ...drafts,
    standardLabelByStandardId: { ...drafts.standardLabelByStandardId, [standardId]: label },
  }
}

export function withSamplingLabel(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
  label: string,
): SubmitOverrideDrafts {
  return {
    ...drafts,
    samplingLabelByCheckpointId: { ...drafts.samplingLabelByCheckpointId, [checkpointId]: label },
  }
}

export function withServingLabel(
  drafts: SubmitOverrideDrafts,
  checkpointId: number,
  label: string,
): SubmitOverrideDrafts {
  return {
    ...drafts,
    servingLabelByCheckpointId: { ...drafts.servingLabelByCheckpointId, [checkpointId]: label },
  }
}

function parseOptionalInt(raw: string): number | undefined {
  return raw === '' ? undefined : Number.parseInt(raw, 10)
}

function parseOptionalFloat(raw: string): number | undefined {
  return raw === '' ? undefined : Number.parseFloat(raw)
}

// Blank or all-whitespace both mean "leave this alone" -- mirrors
// parseOptionalInt/parseOptionalFloat's own "blank means undefined"
// rule for reasoning_parser/dtype/quantization, the three free-text
// serving fields.
function parseOptionalString(raw: string): string | undefined {
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

// Only a field the user actually typed into ends up as a key here.
// Written as one block per field rather than a generic loop over
// `keyof StandardOverrideDraft` -- a loop would need a cast to assign a
// plain `string` onto the select field's narrower literal-union type,
// and this is only four fields.
function buildStandardOverrides(draft: StandardOverrideDraft): StandardOverrides {
  const overrides: StandardOverrides = {}

  const sampleLimit = parseOptionalInt(draft.sample_limit)
  if (sampleLimit !== undefined) {
    overrides.sample_limit = sampleLimit
  }
  const fewShot = parseOptionalInt(draft.few_shot)
  if (fewShot !== undefined) {
    overrides.few_shot = fewShot
  }
  const repeats = parseOptionalInt(draft.repeats)
  if (repeats !== undefined) {
    overrides.repeats = repeats
  }
  if (draft.think_handling !== '') {
    overrides.think_handling = draft.think_handling
  }

  return overrides
}

// Same reasoning as buildStandardOverrides above, over the eight
// sampling fields.
function buildSamplingOverrides(draft: SamplingOverrideDraft): SamplingOverrides {
  const overrides: SamplingOverrides = {}

  const temperature = parseOptionalFloat(draft.temperature)
  if (temperature !== undefined) {
    overrides.temperature = temperature
  }
  const topP = parseOptionalFloat(draft.top_p)
  if (topP !== undefined) {
    overrides.top_p = topP
  }
  const topK = parseOptionalInt(draft.top_k)
  if (topK !== undefined) {
    overrides.top_k = topK
  }
  const minP = parseOptionalFloat(draft.min_p)
  if (minP !== undefined) {
    overrides.min_p = minP
  }
  const presencePenalty = parseOptionalFloat(draft.presence_penalty)
  if (presencePenalty !== undefined) {
    overrides.presence_penalty = presencePenalty
  }
  const repetitionPenalty = parseOptionalFloat(draft.repetition_penalty)
  if (repetitionPenalty !== undefined) {
    overrides.repetition_penalty = repetitionPenalty
  }
  const maxTokens = parseOptionalInt(draft.max_tokens)
  if (maxTokens !== undefined) {
    overrides.max_tokens = maxTokens
  }
  if (draft.enable_thinking !== '') {
    overrides.enable_thinking = draft.enable_thinking === 'true'
  }

  return overrides
}

// Same reasoning again, over the eight ServingOverrides fields.
// gpus/tensor_parallel_size/pipeline_parallel_size/max_model_len parse
// as integers, gpu_memory_utilization as a float, and
// reasoning_parser/dtype/quantization pass through trimmed rather than
// parsed -- they're free text, not numbers.
function buildServingOverrides(draft: ServingOverrideDraft): ServingOverrides {
  const overrides: ServingOverrides = {}

  const gpus = parseOptionalInt(draft.gpus)
  if (gpus !== undefined) {
    overrides.gpus = gpus
  }
  const tensorParallelSize = parseOptionalInt(draft.tensor_parallel_size)
  if (tensorParallelSize !== undefined) {
    overrides.tensor_parallel_size = tensorParallelSize
  }
  const pipelineParallelSize = parseOptionalInt(draft.pipeline_parallel_size)
  if (pipelineParallelSize !== undefined) {
    overrides.pipeline_parallel_size = pipelineParallelSize
  }
  const maxModelLen = parseOptionalInt(draft.max_model_len)
  if (maxModelLen !== undefined) {
    overrides.max_model_len = maxModelLen
  }
  const reasoningParser = parseOptionalString(draft.reasoning_parser)
  if (reasoningParser !== undefined) {
    overrides.reasoning_parser = reasoningParser
  }
  const dtype = parseOptionalString(draft.dtype)
  if (dtype !== undefined) {
    overrides.dtype = dtype
  }
  const quantization = parseOptionalString(draft.quantization)
  if (quantization !== undefined) {
    overrides.quantization = quantization
  }
  const gpuMemoryUtilization = parseOptionalFloat(draft.gpu_memory_utilization)
  if (gpuMemoryUtilization !== undefined) {
    overrides.gpu_memory_utilization = gpuMemoryUtilization
  }

  return overrides
}

// Whether a card has anything to name at all -- a label only makes
// sense once its card has at least one changed field (an unchanged
// card mints no row, so there is nothing for a label to attach to).
// Exported for the cards themselves to gate their own label input's
// visibility on, and for SubmitOverrides.tsx to gate suggestion
// computation on, without either needing to know
// build*Overrides' own sparse-object shape.
export function standardOverrideDraftHasChange(draft: StandardOverrideDraft): boolean {
  return Object.keys(buildStandardOverrides(draft)).length > 0
}

export function samplingOverrideDraftHasChange(draft: SamplingOverrideDraft): boolean {
  return Object.keys(buildSamplingOverrides(draft)).length > 0
}

export function servingOverrideDraftHasChange(draft: ServingOverrideDraft): boolean {
  return Object.keys(buildServingOverrides(draft)).length > 0
}

// The labels already in use for one resource -- the taken set
// suggestNextLabel must never repeat. Built from the *full* catalog
// list (every row, not just the ones selected in the grid right now):
// a standard or profile nobody selected this time can still hold a
// label that's taken.
function takenLabelsFrom<T extends { label: string | null }>(rows: Iterable<T>): Set<string> {
  const labels = new Set<string>()
  for (const row of rows) {
    if (row.label !== null) {
      labels.add(row.label)
    }
  }
  return labels
}

interface LabellableItem {
  id: number
  baseName: string
  hasChange: boolean
  labelDraft: string | null
}

// One axis' resolved labels -- which id gets which label, computed by
// walking `items` in the order given. That order is what suggestNextLabel's
// own "accumulate as you go" contract needs: two items sharing one base
// name (two checkpoints both defaulting to a 'greedy' sampling profile,
// say) must suggest 'greedy-01' and 'greedy-02', not the same name
// twice, so each item's suggestion has to see every earlier item's
// already-resolved label as taken.
//
// An item with no change contributes nothing: nothing would be minted
// for it, so it makes no claim on the taken set and gets no entry in
// the result -- callers only ever render a label input once hasChange
// is true anyway. A label resolved to '' (the draft explicitly cleared
// to "unlabelled") is likewise left out of the result, the same "absent
// beats present-but-empty" rule build*Overrides above already follow.
function resolveLabelsForAxis(
  items: LabellableItem[],
  existingLabels: ReadonlySet<string>,
): Record<number, string> {
  const resolved: Record<number, string> = {}
  const claimed = new Set(existingLabels)
  for (const item of items) {
    if (!item.hasChange) {
      continue
    }
    const label = item.labelDraft ?? suggestNextLabel(item.baseName, claimed)
    if (label !== '') {
      resolved[item.id] = label
      claimed.add(label)
    }
  }
  return resolved
}

// Called from both SubmitOverrides.tsx (to render each card's label
// box) and SubmitPage.tsx (to resolve what buildRequestOverrides below
// actually sends) -- see this file's header comment on why "untouched"
// resolves to a suggestion here rather than in either caller directly:
// both need the exact same computation, over drafts that differ only
// in which SubmitOverrideDrafts snapshot (live vs. debounced) they pass.
export function resolveStandardLabels(
  selectedStandards: StandardSummary[],
  standardsById: Map<number, StandardSummary>,
  drafts: SubmitOverrideDrafts,
): Record<number, string> {
  const items = selectedStandards.map((standard) => ({
    id: standard.id,
    baseName: standard.label ?? standard.benchmark,
    hasChange: standardOverrideDraftHasChange(standardDraftFor(drafts, standard.id)),
    labelDraft: standardLabelDraftFor(drafts, standard.id),
  }))
  return resolveLabelsForAxis(items, takenLabelsFrom(standardsById.values()))
}

export function resolveSamplingLabels(
  selectedCheckpoints: CheckpointListItem[],
  samplingProfilesById: Map<number, SamplingProfileSummary>,
  drafts: SubmitOverrideDrafts,
): Record<number, string> {
  const items = selectedCheckpoints.map((checkpoint) => {
    const profileChoice = drafts.samplingProfileIdByCheckpointId[checkpoint.id] ?? null
    const baseProfile = resolveBaseSamplingProfile(checkpoint, profileChoice, samplingProfilesById)
    return {
      id: checkpoint.id,
      baseName: baseProfile?.label ?? checkpoint.name,
      hasChange: samplingOverrideDraftHasChange(samplingDraftFor(drafts, checkpoint.id)),
      labelDraft: samplingLabelDraftFor(drafts, checkpoint.id),
    }
  })
  return resolveLabelsForAxis(items, takenLabelsFrom(samplingProfilesById.values()))
}

export function resolveServingLabels(
  selectedCheckpoints: CheckpointListItem[],
  servingProfilesById: Map<number, ServingProfileSummary>,
  drafts: SubmitOverrideDrafts,
): Record<number, string> {
  const items = selectedCheckpoints.map((checkpoint) => {
    const profileChoice = drafts.servingProfileIdByCheckpointId[checkpoint.id] ?? null
    const baseProfile = resolveBaseServingProfile(checkpoint, profileChoice, servingProfilesById)
    return {
      id: checkpoint.id,
      baseName: baseProfile?.label ?? checkpoint.name,
      hasChange: servingOverrideDraftHasChange(servingDraftFor(drafts, checkpoint.id)),
      labelDraft: servingLabelDraftFor(drafts, checkpoint.id),
    }
  })
  return resolveLabelsForAxis(items, takenLabelsFrom(servingProfilesById.values()))
}

export interface RequestOverrides {
  standardOverridesByStandardId: Record<number, StandardOverrides>
  samplingOverridesByCheckpointId: Record<number, SamplingOverrides>
  samplingProfileIdByCheckpointId: Record<number, number>
  servingOverridesByCheckpointId: Record<number, ServingOverrides>
  servingProfileIdByCheckpointId: Record<number, number>
  standardLabelByStandardId: Record<number, string>
  samplingLabelByCheckpointId: Record<number, string>
  servingLabelByCheckpointId: Record<number, string>
}

// The wire-shaped overrides CreateRunsRequest/RunPreviewRequest expect,
// built from the drafts above and filtered to the grid's *current*
// selection. A draft for an item just unchecked stays in `drafts` (so
// re-checking it restores what was typed) but must never reach the
// request body -- both because it would describe a pair no longer in
// the grid, and because the backend's own key-membership validator
// (app/schemas/runs.py's `_require_override_keys_are_selected`) 422s on
// an override id outside checkpoint_ids/standard_ids.
//
// The three resolved*LabelBy*Id maps are the already-computed label to
// send for an id, not a raw draft -- see this file's header comment on
// why resolving "untouched" into a suggestion happens in
// SubmitOverrides.tsx, not here. An id missing from one of these maps
// (never resolved, e.g. its card has no change) or resolved to `''`
// (explicitly unlabelled) both mean "omit", the same "absent beats
// present-but-empty" rule buildStandardOverrides etc. already follow
// for every other sparse field.
export function buildRequestOverrides(
  drafts: SubmitOverrideDrafts,
  selectedCheckpointIds: number[],
  selectedStandardIds: number[],
  resolvedStandardLabelByStandardId: Record<number, string>,
  resolvedSamplingLabelByCheckpointId: Record<number, string>,
  resolvedServingLabelByCheckpointId: Record<number, string>,
): RequestOverrides {
  const standardOverridesByStandardId: Record<number, StandardOverrides> = {}
  for (const standardId of selectedStandardIds) {
    const overrides = buildStandardOverrides(standardDraftFor(drafts, standardId))
    if (Object.keys(overrides).length > 0) {
      standardOverridesByStandardId[standardId] = overrides
    }
  }

  const samplingOverridesByCheckpointId: Record<number, SamplingOverrides> = {}
  for (const checkpointId of selectedCheckpointIds) {
    const overrides = buildSamplingOverrides(samplingDraftFor(drafts, checkpointId))
    if (Object.keys(overrides).length > 0) {
      samplingOverridesByCheckpointId[checkpointId] = overrides
    }
  }

  const samplingProfileIdByCheckpointId: Record<number, number> = {}
  for (const checkpointId of selectedCheckpointIds) {
    const profileId = drafts.samplingProfileIdByCheckpointId[checkpointId]
    if (profileId !== undefined) {
      samplingProfileIdByCheckpointId[checkpointId] = profileId
    }
  }

  const servingOverridesByCheckpointId: Record<number, ServingOverrides> = {}
  for (const checkpointId of selectedCheckpointIds) {
    const overrides = buildServingOverrides(servingDraftFor(drafts, checkpointId))
    if (Object.keys(overrides).length > 0) {
      servingOverridesByCheckpointId[checkpointId] = overrides
    }
  }

  const servingProfileIdByCheckpointId: Record<number, number> = {}
  for (const checkpointId of selectedCheckpointIds) {
    const profileId = drafts.servingProfileIdByCheckpointId[checkpointId]
    if (profileId !== undefined) {
      servingProfileIdByCheckpointId[checkpointId] = profileId
    }
  }

  const standardLabelByStandardId: Record<number, string> = {}
  for (const standardId of selectedStandardIds) {
    const label = resolvedStandardLabelByStandardId[standardId]
    if (label !== undefined && label !== '') {
      standardLabelByStandardId[standardId] = label
    }
  }

  const samplingLabelByCheckpointId: Record<number, string> = {}
  for (const checkpointId of selectedCheckpointIds) {
    const label = resolvedSamplingLabelByCheckpointId[checkpointId]
    if (label !== undefined && label !== '') {
      samplingLabelByCheckpointId[checkpointId] = label
    }
  }

  const servingLabelByCheckpointId: Record<number, string> = {}
  for (const checkpointId of selectedCheckpointIds) {
    const label = resolvedServingLabelByCheckpointId[checkpointId]
    if (label !== undefined && label !== '') {
      servingLabelByCheckpointId[checkpointId] = label
    }
  }

  return {
    standardOverridesByStandardId,
    samplingOverridesByCheckpointId,
    samplingProfileIdByCheckpointId,
    servingOverridesByCheckpointId,
    servingProfileIdByCheckpointId,
    standardLabelByStandardId,
    samplingLabelByCheckpointId,
    servingLabelByCheckpointId,
  }
}
