import { Tooltip } from '../Tooltip/Tooltip'
import { formatRelativeTime } from '../../utils/formatRelativeTime'
import { formatTimestamp } from '../../utils/formatTimestamp'
import { cn } from '../../utils/cn'

interface RelativeTimeProps {
  timestamp: string | null
  className?: string
}

// Relative up to 7 days, then a short date, with the full timestamp
// always one hover/focus away -- every screen
// showing when a run finished or a checkpoint was checked renders
// through this instead of picking its own cutoff.
export function RelativeTime({ timestamp, className }: RelativeTimeProps) {
  if (timestamp === null) {
    return <span className={className}>—</span>
  }

  return (
    <Tooltip content={formatTimestamp(timestamp)}>
      <time dateTime={timestamp} tabIndex={0} className={cn('cursor-default', className)}>
        {formatRelativeTime(timestamp)}
      </time>
    </Tooltip>
  )
}
