// Tool calling is two vLLM flags -- `--enable-auto-tool-choice` and
// `--tool-call-parser <name>` -- stored in a serving profile's
// `engine_options`, exactly as catalog/serving-profiles/qwen3-tools.yaml
// writes them. They stay in `engine_options` rather than becoming their
// own fields so no existing profile's hash changes. Shared by the
// registration wizard (which edits a whole profile's engine_options)
// and New evaluation's per-run Serving card (which sends a sparse
// override) -- per .cursor/rules/frontend-components.mdc, logic two
// components need lives in src/utils/.
import type { ServingOverrides, ServingProfileConfig } from '../api/client'

export const TOOL_CALL_PARSER_OPTION = 'tool-call-parser'
export const AUTO_TOOL_CHOICE_OPTION = 'enable-auto-tool-choice'

type EngineOptions = ServingProfileConfig['engine_options']

// A curated list, not every parser vLLM ships: only the ones documented
// for vLLM 0.19.0 (the version every profile pins) that need no extra
// --chat-template or tokenizer flags, since this form can't set those.
// A parser that does need them (llama3_json, mistral, granite) is still
// available through a catalog YAML profile or the API.
export const TOOL_CALL_PARSER_OPTIONS: readonly string[] = [
  'hermes',
  'qwen3_xml',
  'jamba',
  'glm45',
  'glm47',
  'kimi_k2',
  'openai',
  'olmo3',
]

export interface ToolCallingSettings {
  autoToolChoice: boolean
  parser: string | null
}

export function readToolCalling(engineOptions: EngineOptions): ToolCallingSettings {
  const parser = engineOptions[TOOL_CALL_PARSER_OPTION]
  return {
    autoToolChoice: engineOptions[AUTO_TOOL_CHOICE_OPTION] === true,
    parser: typeof parser === 'string' ? parser : null,
  }
}

// How many options a form that edits only the two tool-calling ones
// still carries through untouched -- what the wizard's "N additional
// engine options (not editable here)" note counts.
export function countOtherEngineOptions(engineOptions: EngineOptions): number {
  return Object.keys(engineOptions).filter(
    (key) => key !== AUTO_TOOL_CHOICE_OPTION && key !== TOOL_CALL_PARSER_OPTION,
  ).length
}

function omitKeys(engineOptions: EngineOptions, keysToOmit: string[]): EngineOptions {
  return Object.fromEntries(Object.entries(engineOptions).filter(([key]) => !keysToOmit.includes(key)))
}

// A new engine_options with these settings applied and every other
// option left exactly as it was. Off removes both keys -- never writes
// `false`: a `false` flag renders nothing but would still change the
// profile's hash, and a parser with auto tool choice off does nothing.
export function writeToolCalling(engineOptions: EngineOptions, settings: ToolCallingSettings): EngineOptions {
  const otherOptions = omitKeys(engineOptions, [AUTO_TOOL_CHOICE_OPTION, TOOL_CALL_PARSER_OPTION])
  if (!settings.autoToolChoice) {
    return otherOptions
  }
  if (settings.parser === null) {
    return { ...otherOptions, [AUTO_TOOL_CHOICE_OPTION]: true }
  }
  return { ...otherOptions, [AUTO_TOOL_CHOICE_OPTION]: true, [TOOL_CALL_PARSER_OPTION]: settings.parser }
}

// Whether a profile's tool calling can actually run: auto tool choice
// needs a parser to read the model's tool calls (the backend's
// auto_tool_choice_needs_parser compatibility rule says the same).
export function isToolCallingComplete(settings: ToolCallingSettings): boolean {
  return !settings.autoToolChoice || settings.parser !== null
}

// The dropdown's options: the curated list, plus the profile's current
// parser if a catalog YAML or API-created profile carries one that is
// not on the list -- so it never silently disappears from the form.
export function parserOptionsFor(currentParser: string | null): string[] {
  if (currentParser === null || TOOL_CALL_PARSER_OPTIONS.includes(currentParser)) {
    return [...TOOL_CALL_PARSER_OPTIONS]
  }
  return [...TOOL_CALL_PARSER_OPTIONS, currentParser]
}

export type ToolCallingOverrides = Pick<ServingOverrides, 'enable_auto_tool_choice' | 'tool_call_parser'>

// Mirrors the backend's merge exactly (app/services/runs/submit.py's
// _apply_tool_calling_overrides), so the card's "what would be used"
// never disagrees with what the server resolves. An unset field keeps
// the base profile's value; `enable_auto_tool_choice: false` removes
// both keys; an explicit `null` parser removes just the parser.
export function applyToolCallingOverrides(engineOptions: EngineOptions, overrides: ToolCallingOverrides): EngineOptions {
  if (overrides.enable_auto_tool_choice === false) {
    return omitKeys(engineOptions, [AUTO_TOOL_CHOICE_OPTION, TOOL_CALL_PARSER_OPTION])
  }

  const withAutoToolChoice =
    overrides.enable_auto_tool_choice === true ? { ...engineOptions, [AUTO_TOOL_CHOICE_OPTION]: true } : engineOptions

  if (overrides.tool_call_parser === null) {
    return omitKeys(withAutoToolChoice, [TOOL_CALL_PARSER_OPTION])
  }
  if (overrides.tool_call_parser !== undefined) {
    return { ...withAutoToolChoice, [TOOL_CALL_PARSER_OPTION]: overrides.tool_call_parser }
  }
  return withAutoToolChoice
}
