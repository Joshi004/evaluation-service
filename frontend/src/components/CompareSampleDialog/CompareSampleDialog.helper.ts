// Non-DOM logic for CompareSampleDialog.tsx: the shared prompt (read
// off whichever run's own sample loaded first -- verified identical
// across runs for a flipped sample_key while planning this phase) and
// the per-run-count grid class Tailwind's build-time scanner needs
// written out literally.
import type { UseQueryResult } from '@tanstack/react-query'
import type { DiagnosticsSampleDetail } from '../../api/client'

const GRID_COLUMNS_CLASSES: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
}

export function gridColumnsClassName(runCount: number): string {
  return GRID_COLUMNS_CLASSES[runCount] ?? 'sm:grid-cols-2'
}

export function resolveSharedPrompt(sampleQueries: UseQueryResult<DiagnosticsSampleDetail>[]): string | null {
  for (const query of sampleQueries) {
    if (query.data?.text) {
      return query.data.text.prompt
    }
  }
  return null
}
