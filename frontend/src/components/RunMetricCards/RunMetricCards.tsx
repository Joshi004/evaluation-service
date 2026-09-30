import type { MetricPerformance } from '../../api/client'
import { cn } from '../../utils/cn'
import { Card } from '../Card/Card'
import { buildMetricCardData } from './RunMetricCards.helper'

interface RunMetricCardsProps {
  metrics: MetricPerformance[]
}

// All of a run's own metrics, primary emphasised: cards instead of a
// plain table, so the primary metric (already the verdict band's own
// headline) still reads as the one that matters most among the rest.
export function RunMetricCards({ metrics }: RunMetricCardsProps) {
  if (metrics.length === 0) {
    return <p className="text-sm text-muted-foreground">No metrics yet.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {metrics.map((metric) => {
        const data = buildMetricCardData(metric)
        return (
          <Card key={data.name} className={cn(data.isPrimary && 'border-primary')}>
            <p className="text-xs text-muted-foreground">{data.displayName}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {data.valueText}
              {data.marginText && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">{data.marginText}</span>
              )}
            </p>
            {data.countsText && <p className="mt-1 text-xs text-muted-foreground">{data.countsText}</p>}
          </Card>
        )
      })}
    </div>
  )
}
