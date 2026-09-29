import { Badge } from '../Badge/Badge'
import { CopyButton } from '../CopyButton/CopyButton'
import { Tooltip } from '../Tooltip/Tooltip'
import { cn } from '../../utils/cn'
import { shortenModelName } from '../../utils/shortenModelName'

interface ModelNameProps {
  name: string
  family?: string | null
  copyable?: boolean
  maxLength?: number
  className?: string
}

// §4.5's "Long names" pattern in one place -- every screen that lists
// models (Leaderboard, Runs, Models, Compare) renders through this
// instead of each re-implementing the middle-ellipsis rule. The full
// name always stays reachable: in the tooltip on hover/focus, and in a
// visually-hidden span for a screen reader either way.
export function ModelName({ name, family, copyable = false, maxLength = 25, className }: ModelNameProps) {
  const shortened = shortenModelName(name, maxLength)
  const isShortened = shortened !== name

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {isShortened ? (
        <Tooltip content={name}>
          <span tabIndex={0} className="cursor-default">
            <span aria-hidden="true">{shortened}</span>
            <span className="sr-only">{name}</span>
          </span>
        </Tooltip>
      ) : (
        <span>{name}</span>
      )}
      {family && <Badge tone="neutral">{family}</Badge>}
      {copyable && <CopyButton value={name} label="Copy model name" />}
    </span>
  )
}
