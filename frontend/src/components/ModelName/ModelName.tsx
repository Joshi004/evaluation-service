import type { ReactNode } from 'react'
import { Link } from 'react-router'
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
  // When set, the name itself links to the model page (the
  // Leaderboard's row header is today's only caller) -- the link is
  // the tooltip's own trigger rather than a focusable span nested
  // inside it, so a long, linked name is exactly one keyboard stop,
  // not two.
  to?: string
  className?: string
}

// §4.5's "Long names" pattern in one place -- every screen that lists
// models (Leaderboard, Runs, Models, Compare) renders through this
// instead of each re-implementing the middle-ellipsis rule. The full
// name always stays reachable: in the tooltip on hover/focus, and in a
// visually-hidden span for a screen reader either way.
export function ModelName({ name, family, copyable = false, maxLength = 25, to, className }: ModelNameProps) {
  const shortened = shortenModelName(name, maxLength)
  const isShortened = shortened !== name

  const nameContent = buildNameContent(name, shortened, isShortened, to)

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {nameContent}
      {family && <Badge tone="neutral">{family}</Badge>}
      {copyable && <CopyButton value={name} label="Copy model name" />}
    </span>
  )
}

function buildNameContent(name: string, shortened: string, isShortened: boolean, to: string | undefined): ReactNode {
  const visibleLabel = isShortened ? (
    <>
      <span aria-hidden="true">{shortened}</span>
      <span className="sr-only">{name}</span>
    </>
  ) : (
    name
  )

  const element = to ? (
    <Link to={to} className="text-primary hover:underline">
      {visibleLabel}
    </Link>
  ) : isShortened ? (
    <span tabIndex={0} className="cursor-default">
      {visibleLabel}
    </span>
  ) : (
    <span>{visibleLabel}</span>
  )

  return isShortened ? <Tooltip content={name}>{element}</Tooltip> : element
}
