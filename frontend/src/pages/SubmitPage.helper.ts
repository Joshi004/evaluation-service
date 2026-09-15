// Non-DOM logic for SubmitPage.tsx: debouncing the override drafts
// object before it feeds the dry-run preview query, so typing into one
// of Submit's per-checkpoint or per-standard override fields
// (SubmitOverrides.tsx) doesn't fire a POST /runs/preview per keystroke
// (the plan's own ~400ms figure); and building the id -> row lookups
// DryRunPreview needs to label its resolved-standard,
// resolved-sampling and resolved-serving cards, and SubmitOverrides
// needs to suggest a collision-free label for a new row on any of the
// three axes. Checkpoint/standard selection is not debounced -- a
// checkbox click is already a discrete event, not continuous typing.

import { useEffect, useState } from 'react'
import type {
  CheckpointListItem,
  SamplingProfileSummary,
  ServingProfileSummary,
  StandardSummary,
} from '../api/client'

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}

export function standardsById(standards: StandardSummary[] | undefined): Map<number, StandardSummary> {
  return new Map((standards ?? []).map((standard) => [standard.id, standard]))
}

export function checkpointsById(
  checkpoints: CheckpointListItem[] | undefined,
): Map<number, CheckpointListItem> {
  return new Map((checkpoints ?? []).map((checkpoint) => [checkpoint.id, checkpoint]))
}

export function samplingProfilesById(
  samplingProfiles: SamplingProfileSummary[] | undefined,
): Map<number, SamplingProfileSummary> {
  return new Map((samplingProfiles ?? []).map((profile) => [profile.id, profile]))
}

export function servingProfilesById(
  servingProfiles: ServingProfileSummary[] | undefined,
): Map<number, ServingProfileSummary> {
  return new Map((servingProfiles ?? []).map((profile) => [profile.id, profile]))
}
