import type { SamplingProfileConfig } from '../api/client'

// "32k tokens" for anything at or above 1,000, floor-truncated (not
// rounded) to match how a token budget is usually spoken about --
// 32768 reads as "32k", not "33k".
function formatTokenBudget(maxTokens: number): string {
  return maxTokens >= 1000 ? `${Math.floor(maxTokens / 1000)}k tokens` : `${maxTokens} tokens`
}

// "Thinking on · T 1 · top-p 0.95 · 32k tokens" -- the one-line human
// summary of a sampling profile's shape, shown in SetupChip's tooltip
// so a reader never has to open the Profiles page to see what a setup
// actually asked the model to do. Only the fields that most change
// behaviour are surfaced; the rest (top_k, min_p, penalties, seed)
// stay on the profile's own detail view.
export function samplingSummary(profile: SamplingProfileConfig): string {
  const parts = [
    profile.enable_thinking ? 'Thinking on' : 'Thinking off',
    `T ${profile.temperature}`,
    `top-p ${profile.top_p}`,
    formatTokenBudget(profile.max_tokens),
  ]
  return parts.join(' \u00b7 ')
}
