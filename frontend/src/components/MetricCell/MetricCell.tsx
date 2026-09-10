import { hashToHue } from './MetricCell.helper'

interface MetricCellProps {
  value: number
  comparisonHash: string
}

// One leaderboard score, tinted by comparison_hash -- two cells with
// the same colour were produced the exact same way (same standard AND
// same resolved sampling profile, S-D5); two different colours in the
// same benchmark column is the visual cue that they aren't directly
// comparable.
export function MetricCell({ value, comparisonHash }: MetricCellProps) {
  const hue = hashToHue(comparisonHash)

  return (
    <td
      className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-100"
      style={{ backgroundColor: `hsl(${hue}, 45%, 20%)` }}
      title={`comparison ${comparisonHash}`}
    >
      {/* Scores are stored as fractions (0..1) per docs/DATA_MODEL_V1.md's ground rules. */}
      {(value * 100).toFixed(1)}
    </td>
  )
}
