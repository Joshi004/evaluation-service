import type { UseQueryResult } from '@tanstack/react-query'
import { Server } from 'lucide-react'
import type { EndpointListItem } from '../../api/client'
import { ENDPOINTS_POLL_INTERVAL_MS } from '../../api/queries/endpoints'
import { useNow } from '../../utils/useNow'
import { Button } from '../Button/Button'
import { EmptyState } from '../EmptyState/EmptyState'
import { ErrorState } from '../ErrorState/ErrorState'
import { ModelServerCard } from '../ModelServerCard/ModelServerCard'
import { ModelServersSkeleton } from '../ModelServersSkeleton/ModelServersSkeleton'
import { RunsLiveIndicator } from '../RunsLiveIndicator/RunsLiveIndicator'
import { modelServerListSummary, sumGpus } from './ModelServerList.helper'

interface ModelServerListProps {
  // Fetched once by InfrastructurePage and passed down -- this
  // component owns no query of its own, so the page never runs two 5s
  // pollers against the same endpoint.
  endpoints: UseQueryResult<EndpointListItem[]>
  onStartClick: () => void
}

// Independent of the 5s poll, so each card's own time-to-live bar
// visibly drains between polls rather than only jumping when a new
// response happens to arrive (RunsPage's own `now` ticker documents
// the same reasoning for elapsed-time cells).
const CARD_TICK_INTERVAL_MS = 30_000

// docs/UI_REDESIGN_PLAN.md §8.13, item 1: every live model server as a
// card, with the section's own totals and live indicator above them.
export function ModelServerList({ endpoints, onStartClick }: ModelServerListProps) {
  const now = useNow(CARD_TICK_INTERVAL_MS)

  if (endpoints.isLoading) {
    return <ModelServersSkeleton />
  }

  // A background refetch failing (isRefetchError) keeps the last-good
  // list on screen and is RunsLiveIndicator's own job to surface --
  // only a failure with nothing loaded yet blocks the whole section
  // (the same split RunsPage's own hasBlockingError already makes).
  const hasBlockingError = endpoints.isError && endpoints.data === undefined
  if (hasBlockingError) {
    return (
      <ErrorState
        message="Could not load model servers"
        details={String(endpoints.error)}
        onRetry={() => endpoints.refetch()}
      />
    )
  }

  const liveEndpoints = endpoints.data ?? []

  if (liveEndpoints.length === 0) {
    return (
      <EmptyState
        icon={Server}
        title="No model servers running"
        description="A model server hosts one model on cluster GPUs so evaluations can query it. Runs start one automatically, or you can start one here."
        actions={<Button onClick={onStartClick}>Start a model server</Button>}
      />
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">
          Model servers
          {' \u00b7 '}
          <span className="font-normal text-muted-foreground">
            {modelServerListSummary(liveEndpoints.length, sumGpus(liveEndpoints))}
          </span>
        </h2>
        <RunsLiveIndicator
          pollIntervalMs={ENDPOINTS_POLL_INTERVAL_MS}
          isRefetchError={endpoints.isRefetchError}
          lastCheckedAt={endpoints.dataUpdatedAt || null}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {liveEndpoints.map((endpoint) => (
          <ModelServerCard key={endpoint.id} endpoint={endpoint} now={now} />
        ))}
      </div>
    </section>
  )
}
