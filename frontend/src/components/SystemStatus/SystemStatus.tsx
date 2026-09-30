import { useHealth } from '../../api/queries/health'
import { Popover } from '../Popover/Popover'
import { KeyValueList } from '../KeyValueList/KeyValueList'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import { cn } from '../../utils/cn'
import { describeError } from '../../utils/describeError'
import { HEALTH_DEPENDENCY_LABELS } from '../../utils/labels'
import { classifySystemStatus, SYSTEM_STATUS_DOT_CLASSES } from './SystemStatus.helper'

// The top bar's health pill -- same query, same dependency list, just
// relocated and polling every 30s instead of 10s now that it's on
// screen everywhere, not one page among many.
export function SystemStatus() {
  const health = useHealth()

  const { label, tone } = classifySystemStatus({
    isLoading: health.isLoading,
    isError: health.isError,
    data: health.data,
  })

  return (
    <Popover
      align="end"
      trigger={
        <Button variant="ghost" size="sm" className="gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', SYSTEM_STATUS_DOT_CLASSES[tone])} aria-hidden="true" />
          {label}
        </Button>
      }
    >
      <div className="w-56">
        <p className="mb-2 font-medium text-foreground">System status</p>

        {health.isError && <p className="text-danger">Could not reach the backend: {describeError(health.error)}</p>}

        {health.data && (
          <KeyValueList
            rows={[
              {
                label: 'Overall',
                value: <Badge tone={tone}>{health.data.status === 'ok' ? 'OK' : 'Degraded'}</Badge>,
              },
              ...Object.entries(health.data.dependencies).map(([name, value]) => ({
                label: HEALTH_DEPENDENCY_LABELS[name] ?? name,
                value: (
                  <Badge tone={value === 'ok' ? 'success' : 'danger'}>{value === 'ok' ? 'OK' : value}</Badge>
                ),
              })),
            ]}
          />
        )}
      </div>
    </Popover>
  )
}
