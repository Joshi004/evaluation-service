// Non-DOM logic shared by SamplingProfilesTab.tsx and
// ServingProfilesTab.tsx: turning a catalog's own profile list into the
// rows ProfilesTable renders, plus the "used by" text both tabs' tables
// and (in a slightly different wording) ProfileDetailPanel show.

import type { CheckpointListItem, RunListItem, SamplingProfileSummary, ServingProfileSummary } from '../api/client'
import { samplingSummary } from '../utils/samplingSummary'
import { servingSummary } from '../utils/servingProfileSummary'

export interface SamplingProfileRow {
  profile: SamplingProfileSummary
  name: string
  summary: string
  usedByModelsCount: number
  usedInRunsCount: number
}

export interface ServingProfileRow {
  profile: ServingProfileSummary
  name: string
  summary: string
  usedByModelsCount: number
}

// Labelled profiles first (alphabetically by label), a custom
// (unlabelled) profile last -- an ad-hoc sampling row from a
// customised submit is exactly what this puts at the bottom. Two
// custom profiles (rare in practice) fall back to comparing hashes,
// just so the order is deterministic rather than whatever order the
// API happened to return them in.
function compareProfileNames(aLabel: string | null, aHash: string, bLabel: string | null, bHash: string): number {
  if (aLabel === null && bLabel !== null) {
    return 1
  }
  if (aLabel !== null && bLabel === null) {
    return -1
  }
  if (aLabel !== null && bLabel !== null) {
    return aLabel.localeCompare(bLabel)
  }
  return aHash.localeCompare(bHash)
}

export function buildSamplingProfileRows(
  profiles: SamplingProfileSummary[],
  checkpoints: CheckpointListItem[],
  runs: RunListItem[],
): SamplingProfileRow[] {
  return profiles
    .map((profile) => ({
      profile,
      name: profile.label ?? 'Custom',
      summary: samplingSummary(profile),
      usedByModelsCount: checkpoints.filter(
        (checkpoint) => checkpoint.default_sampling_profile_id === profile.id,
      ).length,
      usedInRunsCount: runs.filter((run) => run.sampling_profile_hash === profile.hash).length,
    }))
    .sort((a, b) => compareProfileNames(a.profile.label, a.profile.hash, b.profile.label, b.profile.hash))
}

// No run count here -- RunListItem carries no serving profile field at
// all, so "used by" for serving can only ever be how many models
// default to it.
export function buildServingProfileRows(
  profiles: ServingProfileSummary[],
  checkpoints: CheckpointListItem[],
): ServingProfileRow[] {
  return profiles
    .map((profile) => ({
      profile,
      name: profile.label ?? 'Custom',
      summary: servingSummary(profile),
      usedByModelsCount: checkpoints.filter((checkpoint) => checkpoint.default_serving_profile_id === profile.id)
        .length,
    }))
    .sort((a, b) => compareProfileNames(a.profile.label, a.profile.hash, b.profile.label, b.profile.hash))
}

// "Default for 3 models · 2 runs" (a labelled profile with both), just
// "3 runs" (a custom profile that's nobody's default) or "Not
// currently used" (neither) -- runsCount omitted entirely drops that
// half for serving, which has no run count to show.
export function formatUsedBy(modelsCount: number, runsCount?: number): string {
  const parts: string[] = []
  if (modelsCount > 0) {
    parts.push(`Default for ${modelsCount} model${modelsCount === 1 ? '' : 's'}`)
  }
  if (runsCount !== undefined && runsCount > 0) {
    parts.push(`${runsCount} run${runsCount === 1 ? '' : 's'}`)
  }
  return parts.length > 0 ? parts.join(' \u00b7 ') : 'Not currently used'
}
