import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'

export type DisclosureSize = 'sm' | 'md'

interface DisclosureProps {
  summary: string
  size?: DisclosureSize
  className?: string
  children: ReactNode
}

const SUMMARY_SIZE_CLASSES: Record<DisclosureSize, string> = {
  md: 'text-sm font-medium text-foreground',
  sm: 'text-xs font-medium text-muted-foreground hover:text-foreground',
}

// A native <details>/<summary> in one shared shape -- JsonDetails' own
// raw-JSON toggle, CatalogPanel's own state legend and
// BenchmarkProtocolTab's own source-file section each hand-rolled a
// bare <details> with its own summary styling and no chevron; this is
// the one both sizes, and the chevron rotation RunsBatchHeaderRow and
// RunSamplesTab's own button-driven toggles also match, now share.
// `open`/`onToggle` are deliberately absent -- every caller today is
// an uncontrolled, closed-by-default disclosure, and native <details>
// already gives that for free.
export function Disclosure({ summary, size = 'md', className, children }: DisclosureProps) {
  return (
    <details className={cn('group', className)}>
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden',
          SUMMARY_SIZE_CLASSES[size],
        )}
      >
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 motion-safe:transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        {summary}
      </summary>
      {children}
    </details>
  )
}
