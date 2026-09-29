// Non-DOM logic for SetupAlignmentList.tsx: joining a preview's own
// pairs against its resolved-sampling entries and the leaderboard's
// existing rows to answer "will this line up?" per pair (Phase 10,
// docs/UI_REDESIGN_PLAN.md §8.10) -- derived entirely from data the
// preview and the leaderboard already return, never computed by
// re-deriving a comparison_hash in the frontend (S-D5's hash is a
// backend concept; this only ever compares hashes it was already
// handed).
import type { LeaderboardRow, RunPreview, SamplingProfileSummary } from '../../api/client'

export interface SetupAlignmentRow {
  key: string
  checkpointName: string
  benchmarkLabel: string
  // null falls through to SetupChip's own "custom <fingerprint>"
  // fallback -- true both when the resolved sampling profile is a
  // genuinely unlabelled row and when it's brand new (samplingProfiles
  // has no row with this hash yet either way).
  samplingProfileLabel: string | null
  samplingProfileHash: string
  existingResultCount: number
}

export function buildSetupAlignmentRows(
  preview: RunPreview,
  leaderboard: LeaderboardRow[],
  samplingProfiles: SamplingProfileSummary[],
): SetupAlignmentRow[] {
  const resolvedSamplingByPairKey = new Map(
    preview.resolved_sampling.map((resolved) => [`${resolved.checkpoint_id}-${resolved.standard_id}`, resolved]),
  )
  const samplingProfileByHash = new Map(samplingProfiles.map((profile) => [profile.hash, profile]))

  const existingCountByComparisonHash = new Map<string, number>()
  for (const row of leaderboard) {
    existingCountByComparisonHash.set(row.comparison_hash, (existingCountByComparisonHash.get(row.comparison_hash) ?? 0) + 1)
  }

  return preview.pairs.map((pair) => {
    const resolvedSampling = resolvedSamplingByPairKey.get(`${pair.checkpoint_id}-${pair.standard_id}`)
    // A hash with no matching row is exactly what "brand new" means --
    // looking it up this way (rather than trusting resolved_sampling's
    // own is_new_sampling_profile flag) also naturally covers a
    // resolved profile that reuses an *existing* row unlabelled, which
    // should show the same fingerprint fallback a new one would.
    const matchedProfile = resolvedSampling ? samplingProfileByHash.get(resolvedSampling.hash) : undefined

    return {
      key: `${pair.checkpoint_id}-${pair.standard_id}`,
      checkpointName: pair.checkpoint_name,
      benchmarkLabel: pair.standard_label ?? pair.benchmark,
      samplingProfileLabel: matchedProfile?.label ?? null,
      samplingProfileHash: resolvedSampling?.hash ?? '',
      existingResultCount: existingCountByComparisonHash.get(pair.comparison_hash) ?? 0,
    }
  })
}
