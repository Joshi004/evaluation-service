// Non-DOM logic for SubmitPage.tsx: debouncing the overrides object
// before it feeds the dry-run preview query, so typing in
// OverrideEditor doesn't fire a POST /runs/preview per keystroke (the
// plan's own ~400ms figure); and building the id -> row lookups
// DryRunPreview needs to label its resolved-standard and
// resolved-sampling cards. Checkpoint/standard selection is not
// debounced -- a checkbox click is already a discrete event, not
// continuous typing.

import { useEffect, useState } from 'react'
import type { CheckpointListItem, StandardSummary } from '../api/client'

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
