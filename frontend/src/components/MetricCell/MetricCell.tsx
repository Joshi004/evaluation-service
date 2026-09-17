import { Link } from 'react-router'
import { hashToHue } from './MetricCell.helper'

interface MetricCellProps {
  value: number
  comparisonHash: string
  evalRunId: number
  // Phase 9 (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md): picking two
  // cells to compare. `selectionFull` is the board's own "two are
  // already picked" state, not this cell's -- a cell already selected
  // must stay checkable (to deselect) even while the board is full.
  selected: boolean
  selectionFull: boolean
  onToggleSelected: () => void
}

// One leaderboard score, tinted by comparison_hash -- two cells with
// the same colour were produced the exact same way (same standard AND
// same resolved sampling profile, S-D5); two different colours in the
// same benchmark column is the visual cue that they aren't directly
// comparable. The value itself links to its run
// (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 1) -- the
// leaderboard's most natural entry point into a run's own detail page.
export function MetricCell({
  value,
  comparisonHash,
  evalRunId,
  selected,
  selectionFull,
  onToggleSelected,
}: MetricCellProps) {
  const hue = hashToHue(comparisonHash)

  return (
    <td
      className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-100"
      style={{ backgroundColor: `hsl(${hue}, 45%, 20%)` }}
      title={`comparison ${comparisonHash}`}
    >
      <div className="flex items-center justify-end gap-1.5">
        {/* Disabled once two cells are already picked, unless this is
            one of them -- a third pick is a no-op, not a silent
            eviction of an existing one (Phase 9's own "exactly two"
            rule has to stay visible). */}
        <input
          type="checkbox"
          checked={selected}
          disabled={selectionFull && !selected}
          onChange={onToggleSelected}
          aria-label={`Select run #${evalRunId} to compare`}
          className="h-3.5 w-3.5 disabled:opacity-40"
        />
        {/* Scores are stored as fractions (0..1) per docs/DATA_MODEL_V1.md's ground rules. */}
        <Link to={`/runs/${evalRunId}`} className="hover:underline">
          {(value * 100).toFixed(1)}
        </Link>
      </div>
    </td>
  )
}
