import { hashToHue } from './MetricCell.helper'

interface MetricCellProps {
  value: number
  recipeHash: string
}

// One leaderboard score, tinted by which recipe produced it -- two cells
// with the same colour were scored the exact same way; two different
// colours in the same benchmark column is the visual cue that they
// aren't directly comparable.
export function MetricCell({ value, recipeHash }: MetricCellProps) {
  const hue = hashToHue(recipeHash)

  return (
    <td
      className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-100"
      style={{ backgroundColor: `hsl(${hue}, 45%, 20%)` }}
      title={`recipe ${recipeHash}`}
    >
      {/* Scores are stored as fractions (0..1) per docs/DATA_MODEL_V1.md's ground rules. */}
      {(value * 100).toFixed(1)}
    </td>
  )
}
