import { Network } from 'lucide-react'
import { useClusterPartitions } from '../../api/queries/cluster'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import { Callout } from '../Callout/Callout'
import { Card } from '../Card/Card'
import { EmptyState } from '../EmptyState/EmptyState'
import { ErrorState } from '../ErrorState/ErrorState'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { Skeleton } from '../Skeleton/Skeleton'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { buildPartitionRows } from './ClusterPartitionsCard.helper'

// The cluster's own partition list, read only on request (ground rule
// 15 -- this is an SSH-backed read, never polled). `useClusterPartitions`
// seeds itself from a week-old localStorage cache, so `hasData` below
// is true on most page loads even before anyone clicks Refresh.
export function ClusterPartitionsCard() {
  const partitionsQuery = useClusterPartitions()
  const hasData = partitionsQuery.data !== undefined
  const refreshedAt = partitionsQuery.dataUpdatedAt
    ? new Date(partitionsQuery.dataUpdatedAt).toISOString()
    : null

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">Cluster partitions</h2>
        {hasData && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Refreshed <RelativeTime timestamp={refreshedAt} />
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => partitionsQuery.refetch()}
              loading={partitionsQuery.isFetching}
            >
              Refresh
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3">
        {!hasData && partitionsQuery.isFetching && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {!hasData && !partitionsQuery.isFetching && partitionsQuery.isError && (
          <ErrorState
            message="Could not load partitions from the cluster"
            details={String(partitionsQuery.error)}
            onRetry={() => partitionsQuery.refetch()}
          />
        )}

        {!hasData && !partitionsQuery.isFetching && !partitionsQuery.isError && (
          <EmptyState
            icon={Network}
            title="Cluster partitions not loaded"
            description="They're read straight from the cluster, so that only happens when you ask."
            actions={<Button size="sm" onClick={() => partitionsQuery.refetch()}>Load</Button>}
          />
        )}

        {hasData && partitionsQuery.data && (
          <>
            {partitionsQuery.isError && (
              <Callout tone="warning" className="mb-3">
                Showing the list from <RelativeTime timestamp={refreshedAt} />.
              </Callout>
            )}
            <Table>
              <thead>
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>State</TableHeaderCell>
                  <TableHeaderCell className="text-right">Priority tier</TableHeaderCell>
                  <TableHeaderCell>Hidden</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {buildPartitionRows(partitionsQuery.data).map((row) => (
                  <tr key={row.name}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {row.name}
                        {row.isDefault && <Badge>Default</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge tone={row.stateTone}>{row.stateLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.priorityTier}</TableCell>
                    <TableCell>{row.hidden ? 'Yes' : 'No'}</TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </div>
    </Card>
  )
}
