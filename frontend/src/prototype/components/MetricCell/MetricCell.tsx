import type { EvalRun } from '../../data/types'
import { ConfidenceInterval } from '../ConfidenceInterval/ConfidenceInterval'
import type { MetricUnit } from '../ConfidenceInterval/ConfidenceInterval.helper'
import { getCellTitle, getCellTone } from './MetricCell.helper'

interface MetricCellProps {
  run: EvalRun | null
  value: number | null
  stderr: number | null
  unit: MetricUnit
  onSelect: (run: EvalRun) => void
}

const TONE_CLASSES: Record<'standard' | 'exploratory' | 'flagged', string> = {
  standard: '',
  exploratory: 'italic opacity-70',
  flagged: 'ring-1 ring-amber-500/50',
}

// One cell of the leaderboard grid — a (checkpoint, benchmark) score with
// its interval, clickable to open the methodology behind it. Renders "—"
// when there's no run for this pair at all.
export function MetricCell({ run, value, stderr, unit, onSelect }: MetricCellProps) {
  if (!run || value === null || stderr === null) {
    return <span className="text-slate-600">—</span>
  }

  const tone = getCellTone(run)

  return (
    <button
      type="button"
      onClick={() => onSelect(run)}
      title={getCellTitle(run)}
      className={`rounded px-1.5 py-1 text-left hover:bg-slate-800 ${TONE_CLASSES[tone]}`}
    >
      <ConfidenceInterval value={value} stderr={stderr} unit={unit} />
    </button>
  )
}
