// Non-DOM logic for ChatSettingsPanel.tsx: the panel's own local draft
// (every field as a string, the same "free typing, parsed only at
// commit" shape ServingProfilePicker.helper.ts already uses), and the
// conversions between that draft and the real ChatSamplingSettings the
// conversation actually sends.
import type { ChatSamplingSettings, SamplingProfileSummary } from '../../api/client'
import { chatSettingsFromSamplingProfile } from '../../pages/ChatPage.helper'

export interface ChatSettingsDraft {
  samplingProfileId: number | null
  temperature: string
  topP: string
  topK: string
  presencePenalty: string
  repetitionPenalty: string
  maxTokens: string
  enableThinking: boolean
  // '' means "let vLLM draw its own per-request seed" (null on the
  // wire) -- there is no other sentinel a number field could use for
  // "unset".
  seed: string
  systemPrompt: string
}

interface FieldBounds {
  min: number
  max: number
  step: number
  // Backend bound is `gt`, not `ge` -- HTML's own `min` attribute is
  // always inclusive, so `min` above is already one step inside the
  // true floor; this only controls the hint text shown under the
  // field ("> 0" vs "0").
  exclusiveMin?: boolean
}

// Mirrors app/schemas/endpoints.py's own ChatSamplingSettings bounds
// exactly -- drives both each field's <input min/max/step> and
// parseDraftSettings' own clamp below, so the UI can never produce a
// value the backend would 422 on.
export const SAMPLING_FIELD_BOUNDS = {
  temperature: { min: 0, max: 2, step: 0.01 },
  topP: { min: 0.01, max: 1, step: 0.01, exclusiveMin: true },
  topK: { min: -1, max: 20_000, step: 1 },
  presencePenalty: { min: -2, max: 2, step: 0.01 },
  repetitionPenalty: { min: 0.01, max: 2, step: 0.01, exclusiveMin: true },
  maxTokens: { min: 1, max: 32_768, step: 1 },
  seed: { min: 0, max: 2_147_483_647, step: 1 },
} satisfies Record<string, FieldBounds>

export function boundsHint(bounds: FieldBounds): string {
  const min = bounds.exclusiveMin ? `>${bounds.min}` : bounds.min.toLocaleString()
  return `${min}\u2013${bounds.max.toLocaleString()}`
}

function clampedNumber(raw: string, bounds: FieldBounds, fallback: number): number {
  const parsed = Number(raw)
  const safe = Number.isFinite(parsed) ? parsed : fallback
  return Math.min(Math.max(safe, bounds.min), bounds.max)
}

export function draftFromSettings(
  settings: ChatSamplingSettings,
  samplingProfileId: number | null,
  systemPrompt: string | null,
): ChatSettingsDraft {
  return {
    samplingProfileId,
    temperature: String(settings.temperature),
    topP: String(settings.top_p),
    topK: String(settings.top_k),
    presencePenalty: String(settings.presence_penalty),
    repetitionPenalty: String(settings.repetition_penalty),
    maxTokens: String(settings.max_tokens),
    enableThinking: settings.enable_thinking,
    seed: settings.seed === null ? '' : String(settings.seed),
    systemPrompt: systemPrompt ?? '',
  }
}

// Used by both the profile SelectField and "Reset to profile" -- every
// sampling field snaps to that profile's own values, but the system
// prompt (not part of any sampling profile) is carried over from
// whatever the draft already held.
export function applyProfileToDraft(draft: ChatSettingsDraft, profile: SamplingProfileSummary): ChatSettingsDraft {
  return draftFromSettings(chatSettingsFromSamplingProfile(profile), profile.id, draft.systemPrompt)
}

// Parses and clamps every numeric field into a valid
// ChatSamplingSettings -- a value outside bounds is pulled back to the
// nearest edge rather than refusing to save, since this is a manual
// testing tool with no submit-time review step of its own to surface a
// rejection through.
export function parseDraftSettings(draft: ChatSettingsDraft): ChatSamplingSettings {
  const seed =
    draft.seed.trim() === '' ? null : Math.round(clampedNumber(draft.seed, SAMPLING_FIELD_BOUNDS.seed, 0))
  return {
    temperature: clampedNumber(draft.temperature, SAMPLING_FIELD_BOUNDS.temperature, 1),
    top_p: clampedNumber(draft.topP, SAMPLING_FIELD_BOUNDS.topP, 1),
    top_k: Math.round(clampedNumber(draft.topK, SAMPLING_FIELD_BOUNDS.topK, -1)),
    presence_penalty: clampedNumber(draft.presencePenalty, SAMPLING_FIELD_BOUNDS.presencePenalty, 0),
    repetition_penalty: clampedNumber(draft.repetitionPenalty, SAMPLING_FIELD_BOUNDS.repetitionPenalty, 1),
    max_tokens: Math.round(clampedNumber(draft.maxTokens, SAMPLING_FIELD_BOUNDS.maxTokens, 1024)),
    enable_thinking: draft.enableThinking,
    seed,
  }
}

export function draftSystemPrompt(draft: ChatSettingsDraft): string | null {
  return draft.systemPrompt.trim() === '' ? null : draft.systemPrompt
}
