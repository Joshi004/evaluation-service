import { useHealth } from '../../api/queries/health'
import { Badge } from '../Badge/Badge'
import { Card } from '../Card/Card'
import { KeyValueList } from '../KeyValueList/KeyValueList'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { Tooltip } from '../Tooltip/Tooltip'
import { buildHealthRows } from './SystemHealthCard.helper'

// The same useHealth() query that backs the top-bar status pill, read
// here as a small Backend + Database panel instead of a popover.
export function SystemHealthCard() {
  const health = useHealth()
  const rows = buildHealthRows({ isLoading: health.isLoading, isError: health.isError, data: health.data })
  const checkedAt = health.dataUpdatedAt ? new Date(health.dataUpdatedAt).toISOString() : null

  return (
    <Card>
      <h2 className="text-sm font-medium text-foreground">System health</h2>
      <div className="mt-3">
        <KeyValueList
          rows={rows.map((row) => ({
            label: row.label,
            value: row.tooltip ? (
              <Tooltip content={row.tooltip}>
                <span tabIndex={0}>
                  <Badge tone={row.tone}>{row.status}</Badge>
                </span>
              </Tooltip>
            ) : (
              <Badge tone={row.tone}>{row.status}</Badge>
            ),
          }))}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Checked <RelativeTime timestamp={checkedAt} />
      </p>
    </Card>
  )
}
