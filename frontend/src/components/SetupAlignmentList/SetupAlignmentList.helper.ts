// Non-DOM logic for SetupAlignmentList.tsx: joining a preview's own
// pairs against its resolved-standard and resolved-sampling entries
// and the leaderboard's existing rows to answer "will this line up?"
// per pair -- derived entirely from data the preview and the
// leaderboard already return, never computed by re-deriving a
// comparison_hash in the frontend (the hash is a backend concept; this
// only ever compares hashes it was already handed). The benchmark and
// sampling-profile names shown alongside that verdict are the
// *resolved* names -- whichever row (new or existing) the panel's own
// customization actually lands on, named the same way a real submit
// would name it (standardLabelByStandardId/samplingLabelByCheckpointId,
// both already resolved by SubmitOverrides.helper.ts), not just the
// names the grid started with.
import type {
  LeaderboardRow,
  ResolvedSamplingPreview,
  ResolvedStandardPreview,
  RunPreview,
  RunPreviewPair,
  SamplingProfileSummary,
  StandardSummary,
} from '../../api/client'
import { shortFingerprint } from '../../utils/shortFingerprint'

export interface SetupAlignmentRow {
  key: string
  checkpointName: string
  benchmarkLabel: string
  // null falls through to SetupChip's own "custom <fingerprint>"
  // fallback -- true when the resolved sampling profile is a
  // genuinely unlabelled existing row, or when it's brand new and the
  // panel's own label field was cleared. A brand new profile given a
  // label (SubmitOverrides.helper.ts's own resolveSamplingLabels)
  // shows that label instead -- the name this exact submit would mint.
  samplingProfileLabel: string | null
  samplingProfileHash: string
  existingResultCount: number
}

// This pair's benchmark name, after the panel's own customization --
// the catalog's base label unchanged unless the protocol was actually
// edited, in which case it's whichever row the edit resolves to: a
// brand new row's own about-to-be-minted label (or a Custom(...)
// fallback if that label field was cleared), or -- when the override
// combination happens to hash-match a row that already exists -- that
// existing row's own label (submit reuses it untouched, so whatever
// was typed into the panel's label field is ignored here too).
function resolvedBenchmarkLabel(
  pair: RunPreviewPair,
  resolvedStandardByBaseId: Map<number, ResolvedStandardPreview>,
  standardByHash: Map<string, StandardSummary>,
  standardLabelByStandardId: Record<number, string>,
): string {
  const baseLabel = pair.standard_label ?? pair.benchmark
  const resolved = resolvedStandardByBaseId.get(pair.standard_id)
  if (!resolved || resolved.changed_fields.length === 0) {
    return baseLabel
  }
  if (resolved.is_new_standard) {
    return standardLabelByStandardId[resolved.base_standard_id] ?? `Custom (${shortFingerprint(resolved.hash)})`
  }
  return standardByHash.get(resolved.hash)?.label ?? `Custom (${shortFingerprint(resolved.hash)})`
}

// This pair's resolved sampling profile's name. Mirrors
// resolvedBenchmarkLabel's own existing-vs-new split, one axis over --
// `matchedProfile` already covers "resolves to an existing row" (found
// by hash, the same lookup today's code always did), including that
// row's own null label (a genuinely unlabelled existing profile), so
// only the brand new case needs its own branch: the label this submit
// will give the new row, or null (the same Custom(...) fallback) if
// it was left unlabelled.
function resolvedSamplingProfileLabel(
  resolvedSampling: ResolvedSamplingPreview | undefined,
  matchedProfile: SamplingProfileSummary | undefined,
  checkpointId: number,
  samplingLabelByCheckpointId: Record<number, string>,
): string | null {
  if (matchedProfile) {
    return matchedProfile.label
  }
  if (resolvedSampling?.is_new_sampling_profile) {
    return samplingLabelByCheckpointId[checkpointId] ?? null
  }
  return null
}

export function buildSetupAlignmentRows(
  preview: RunPreview,
  leaderboard: LeaderboardRow[],
  samplingProfiles: SamplingProfileSummary[],
  standardsById: Map<number, StandardSummary>,
  standardLabelByStandardId: Record<number, string>,
  samplingLabelByCheckpointId: Record<number, string>,
): SetupAlignmentRow[] {
  const resolvedSamplingByPairKey = new Map(
    preview.resolved_sampling.map((resolved) => [`${resolved.checkpoint_id}-${resolved.standard_id}`, resolved]),
  )
  const resolvedStandardByBaseId = new Map(
    preview.resolved_standards.map((resolved) => [resolved.base_standard_id, resolved]),
  )
  const samplingProfileByHash = new Map(samplingProfiles.map((profile) => [profile.hash, profile]))
  const standardByHash = new Map([...standardsById.values()].map((standard) => [standard.hash, standard]))

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
      benchmarkLabel: resolvedBenchmarkLabel(pair, resolvedStandardByBaseId, standardByHash, standardLabelByStandardId),
      samplingProfileLabel: resolvedSamplingProfileLabel(
        resolvedSampling,
        matchedProfile,
        pair.checkpoint_id,
        samplingLabelByCheckpointId,
      ),
      samplingProfileHash: resolvedSampling?.hash ?? '',
      existingResultCount: existingCountByComparisonHash.get(pair.comparison_hash) ?? 0,
    }
  })
}
