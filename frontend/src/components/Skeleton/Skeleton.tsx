import { cn } from '../../utils/cn'

interface SkeletonProps {
  className?: string
}

// One pulsing block. Loading states are built by composing several of
// these into the shape of the content that will replace them (§4.5:
// "shaped like the final layout", never the text "Loading..."); this
// primitive intentionally stays generic rather than guessing at any
// one page's layout.
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}
