import type { ModelEvaluatedResult } from '../../utils/modelResults'
import { cn } from '../../utils/cn'
import { ScoreValue } from '../ScoreValue/ScoreValue'

interface ModelLatestScoresProps {
  evaluated: ModelEvaluatedResult[]
  className?: string
}

const MAX_VISIBLE_SCORES = 3

// Up to 3 mini scores, most recently evaluated first, then "+N more"
// -- the Models list' own glance at what a model has been run on; the
// model page's own ModelScorecard is where every setup's full detail
// actually lives.
export function ModelLatestScores({ evaluated, className }: ModelLatestScoresProps) {
  if (evaluated.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>Not evaluated yet</p>
  }

  const sortedByRecency = [...evaluated].sort(
    (a, b) => new Date(b.cell.finishedAt).getTime() - new Date(a.cell.finishedAt).getTime(),
  )
  const visible = sortedByRecency.slice(0, MAX_VISIBLE_SCORES)
  const remaining = sortedByRecency.length - visible.length

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {visible.map((entry) => (
        <div key={`${entry.benchmark}-${entry.setup.comparisonHash}`} className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{entry.benchmarkDisplayName}</span>
          <ScoreValue value={entry.cell.value} />
        </div>
      ))}
      {remaining > 0 && <span className="text-xs text-muted-foreground">+{remaining} more</span>}
    </div>
  )
}
