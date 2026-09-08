import type { StatusTone } from '../StatusBadge/StatusBadge.helper'
import type { PredictionDiffRow } from '../../data/predictions'

export type DiffVerdict = 'a-wins' | 'b-wins' | 'both-pass' | 'both-fail' | 'incomplete'

// Deliberately not just "did A win" — a diff table that only ever shows
// wins isn't credible, so rows where both models pass or both fail get
// their own verdicts rather than being silently dropped.
export function computeDiffVerdict(row: PredictionDiffRow): DiffVerdict {
  if (!row.a || !row.b) return 'incomplete'
  if (row.a.correct && row.b.correct) return 'both-pass'
  if (!row.a.correct && !row.b.correct) return 'both-fail'
  return row.a.correct ? 'a-wins' : 'b-wins'
}

export function verdictLabel(verdict: DiffVerdict, checkpointAName: string, checkpointBName: string): string {
  switch (verdict) {
    case 'a-wins':
      return `${checkpointAName} only`
    case 'b-wins':
      return `${checkpointBName} only`
    case 'both-pass':
      return 'Both pass'
    case 'both-fail':
      return 'Both fail'
    case 'incomplete':
      return 'No data'
  }
}

export function verdictTone(verdict: DiffVerdict): StatusTone {
  switch (verdict) {
    case 'a-wins':
    case 'b-wins':
      return 'warning'
    case 'both-pass':
      return 'positive'
    case 'both-fail':
      return 'danger'
    case 'incomplete':
      return 'neutral'
  }
}
