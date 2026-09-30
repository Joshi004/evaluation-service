import { Badge } from '../components/Badge/Badge'
import { BenchmarkLeaderboardPreview } from '../components/BenchmarkLeaderboardPreview/BenchmarkLeaderboardPreview'
import { Card } from '../components/Card/Card'
import { Table, TableCell, TableHeaderCell } from '../components/Table/Table'
import { protocolSummary } from '../utils/protocolSummary'
import { useBenchmarkPage } from './BenchmarkDetailPage.helper'

// The Benchmark detail page's default tab (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12): what this benchmark measures and how
// it's scored, then a slice of the leaderboard for this exact standard
// version. The settings that change what gets measured live on the
// Protocol tab instead (§3 rule 2, "results lead").
export function BenchmarkOverviewTab() {
  const { standard, board } = useBenchmarkPage()

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-medium text-foreground">What it measures</h2>
        <div className="mt-3 space-y-2 text-sm">
          {standard.description && <p className="text-foreground">{standard.description}</p>}
          <p className="text-muted-foreground">{protocolSummary(standard)}</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-foreground">How it's scored</h2>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <TableHeaderCell>Metric</TableHeaderCell>
                <TableHeaderCell>Direction</TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {standard.metrics.map((metric) => (
                <tr key={metric.name}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      {metric.display_name}
                      {metric.is_primary && <Badge tone="info">Headline score</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>{metric.higher_is_better ? 'Higher is better' : 'Lower is better'}</TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-foreground">Leaderboard</h2>
        <div className="mt-3">
          <BenchmarkLeaderboardPreview standard={standard} board={board} />
        </div>
      </Card>
    </div>
  )
}
