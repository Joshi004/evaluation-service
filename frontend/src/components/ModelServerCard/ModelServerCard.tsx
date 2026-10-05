import { Link } from 'react-router'
import { MessageSquare } from 'lucide-react'
import type { EndpointListItem } from '../../api/client'
import { cn } from '../../utils/cn'
import { paths } from '../../utils/paths'
import { Badge } from '../Badge/Badge'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { Card } from '../Card/Card'
import { CopyButton } from '../CopyButton/CopyButton'
import { KeyValueList } from '../KeyValueList/KeyValueList'
import { KillModelServerButton } from '../KillModelServerButton/KillModelServerButton'
import { ModelName } from '../ModelName/ModelName'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { TimeToLiveBar } from '../TimeToLiveBar/TimeToLiveBar'
import { Tooltip } from '../Tooltip/Tooltip'
import { modelServerStatus } from './ModelServerCard.helper'

interface ModelServerCardProps {
  endpoint: EndpointListItem
  // Shared with every other card and with the section header's own
  // GPU total (ModelServerList) -- one useNow ticker, not one per
  // card.
  now: Date
}

// One live model server: what it's serving, where, its own
// time-to-live bar, and the one button that ends it.
export function ModelServerCard({ endpoint, now }: ModelServerCardProps) {
  const status = modelServerStatus(endpoint, now)
  const StatusIcon = status.icon

  const statusBadge = (
    <Badge tone={status.tone} className="gap-1">
      <StatusIcon className={cn('h-3 w-3', status.spin && 'motion-safe:animate-spin')} aria-hidden="true" />
      {status.label}
    </Badge>
  )

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <ModelName name={endpoint.checkpoint_name} to={paths.model(endpoint.checkpoint_id)} />
        {status.tooltip ? (
          <Tooltip content={status.tooltip}>
            <span tabIndex={0}>{statusBadge}</span>
          </Tooltip>
        ) : (
          statusBadge
        )}
      </div>

      <KeyValueList
        rows={[
          { label: 'GPUs', value: endpoint.gpus },
          { label: 'Cluster partition', value: endpoint.partition ?? '\u2014' },
          { label: 'SLURM job', value: endpoint.slurm_job_id ?? '\u2014' },
          {
            label: 'URL',
            value: endpoint.url ? (
              <span className="inline-flex items-center gap-1 font-mono text-xs break-all">
                {endpoint.url}
                <CopyButton value={endpoint.url} label="Copy model server URL" />
              </span>
            ) : (
              'Not serving yet'
            ),
          },
        ]}
      />

      <TimeToLiveBar createdAt={endpoint.created_at} expiresAt={endpoint.expires_at} now={now} />

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          Started <RelativeTime timestamp={endpoint.created_at} />
        </p>
        <div className="flex items-center gap-2">
          {/* Only once actually serving -- chatting against a still-
              starting endpoint has no url to proxy through yet. */}
          {endpoint.url !== null && (
            <Link
              to={paths.chat(endpoint.checkpoint_id)}
              className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Chat
            </Link>
          )}
          <KillModelServerButton endpoint={endpoint} />
        </div>
      </div>
    </Card>
  )
}
