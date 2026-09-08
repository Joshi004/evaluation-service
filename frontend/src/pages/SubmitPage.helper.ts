// Non-DOM logic for SubmitPage.tsx: debouncing the overrides object
// before it feeds the dry-run preview query, so typing in
// OverrideEditor doesn't fire a POST /runs/preview per keystroke (the
// plan's own ~400ms figure). Checkpoint/recipe selection is not
// debounced -- a checkbox click is already a discrete event, not
// continuous typing.

import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}
