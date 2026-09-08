import type { Benchmark, Checkpoint, ResolvedProfile, RunProfileSources, ThinkHandling } from '../data/types'
import { getRecipe } from '../data/recipes'

// Stands in for reading a checkpoint's own generation_config.json (see
// EVAL_SERVICE_PLAN.md Section 5 — vLLM applies this silently unless every
// field is set explicitly, which is exactly the failure resolving and
// hashing is meant to catch). Only the Qwen3-4B-derived checkpoints carry
// one here, matching the real incident this prototype is anchored on.
const CHECKPOINT_GENERATION_CONFIG: Record<string, { temperature: number; topP: number; topK: number }> = {
  'qwen3-4b-allternary-ep03': { temperature: 0.6, topP: 0.95, topK: 20 },
  'qwen3-4b-rl-step400': { temperature: 0.6, topP: 0.95, topK: 20 },
  'qwen3-4b-rl-step600': { temperature: 0.6, topP: 0.95, topK: 20 },
  'qwen3-4b-sft-v1': { temperature: 0.6, topP: 0.95, topK: 20 },
  'qwen3-4b-sft-v2': { temperature: 0.6, topP: 0.95, topK: 20 },
}

export interface ProfileOverrides {
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  thinkHandling?: ThinkHandling
}

// Turns the three Layer 2 source choices into the concrete values that
// would actually be sent to the model server — the "resolved, not
// requested" values from EVAL_SERVICE_PLAN.md Section 5.
export function resolveProfile(
  benchmark: Benchmark,
  checkpoint: Checkpoint,
  sources: RunProfileSources,
  userOverrides: ProfileOverrides,
): ResolvedProfile {
  const recipe = getRecipe(benchmark.id)

  const sampling =
    sources.sampling === 'from_checkpoint'
      ? // No known generation_config.json for this checkpoint in this fixture
        // set falls back to the recipe's own default rather than modeling a
        // third "raw engine default" case this demo doesn't need.
        CHECKPOINT_GENERATION_CONFIG[checkpoint.id] ?? recipe.defaultSampling
      : sources.sampling === 'user_provided'
        ? {
            temperature: userOverrides.temperature ?? recipe.defaultSampling.temperature,
            topP: userOverrides.topP ?? recipe.defaultSampling.topP,
            topK: userOverrides.topK ?? recipe.defaultSampling.topK,
          }
        : recipe.defaultSampling

  // A checkpoint's generation_config.json has no opinion on think-handling
  // or max_tokens — those aren't sampling parameters — so 'from_checkpoint'
  // falls back to the recipe default for these two exactly as it would in
  // the real system.
  const thinkHandling: ThinkHandling =
    sources.thinkHandling === 'user_provided'
      ? userOverrides.thinkHandling ?? recipe.defaultThinkHandling
      : recipe.defaultThinkHandling

  const maxTokens =
    sources.maxTokens === 'user_provided' ? userOverrides.maxTokens ?? recipe.defaultMaxTokens : recipe.defaultMaxTokens

  return { ...sampling, maxTokens, thinkHandling }
}

// A short, display-only, deterministic hash — real hashing happens over
// resolved_profile + recipe_hash server-side. This only needs to look
// authentic and stay stable for identical inputs.
export function computeMockProfileHash(resolved: ResolvedProfile, recipeHash: string): string {
  const raw = `${recipeHash}:${resolved.temperature}:${resolved.topP}:${resolved.topK}:${resolved.maxTokens}:${resolved.thinkHandling}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  }
  return `p-${hash.toString(16).padStart(8, '0')}`
}
