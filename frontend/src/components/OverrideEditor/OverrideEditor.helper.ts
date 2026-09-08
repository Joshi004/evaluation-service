// Non-DOM logic for OverrideEditor.tsx: its draft form state (every
// field kept as a plain string, since that's what <input>/<select>
// bind to) and the conversion into the sparse RecipeOverrides the
// backend expects.
//
// A field left blank in the draft must end up entirely absent from the
// resulting RecipeOverrides, not present with some default value --
// see app/schemas/runs.py's RecipeOverrides docstring on why the
// backend (Pydantic's exclude_unset) needs "the key is absent" and "the
// key is present" to stay distinguishable. Both selects use '' the same
// way, for the same reason.

import type { RecipeOverrides } from '../../api/client'

export interface OverrideDraft {
  sample_limit: string
  few_shot: string
  repeats: string
  temperature: string
  top_p: string
  top_k: string
  min_p: string
  presence_penalty: string
  repetition_penalty: string
  max_tokens: string
  enable_thinking: '' | 'true' | 'false'
  think_handling: '' | 'strip' | 'as_is'
}

export const EMPTY_OVERRIDE_DRAFT: OverrideDraft = {
  sample_limit: '',
  few_shot: '',
  repeats: '',
  temperature: '',
  top_p: '',
  top_k: '',
  min_p: '',
  presence_penalty: '',
  repetition_penalty: '',
  max_tokens: '',
  enable_thinking: '',
  think_handling: '',
}

function parseOptionalInt(raw: string): number | undefined {
  return raw === '' ? undefined : Number.parseInt(raw, 10)
}

function parseOptionalFloat(raw: string): number | undefined {
  return raw === '' ? undefined : Number.parseFloat(raw)
}

// Only a field the user actually typed into ends up as a key here.
// Written as one block per field rather than a generic loop over
// `keyof OverrideDraft` -- a loop would need a cast to assign a plain
// `string` onto the two select fields' narrower literal-union types,
// and this is only 12 fields.
export function buildOverridesFromDraft(draft: OverrideDraft): RecipeOverrides {
  const overrides: RecipeOverrides = {}

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
  if (draft.think_handling !== '') {
    overrides.think_handling = draft.think_handling
  }

  return overrides
}
