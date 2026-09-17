import { useEffect, useState } from 'react'

// Promoted from SubmitPage.helper.ts once a second caller
// (SampleFilters, docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 4)
// needed the same debounce -- per .cursor/rules/frontend-components.mdc,
// "once a second component needs the same logic, promote it to a flat
// file in src/utils/ ... so both import it from one place instead of
// duplicating it."
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}
