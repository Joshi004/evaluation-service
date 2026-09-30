import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useRunSample } from '../../api/queries/runDiagnostics'
import { cn } from '../../utils/cn'
import { isNotFoundError } from '../../utils/isNotFoundError'
import { paths } from '../../utils/paths'
import { Badge } from '../Badge/Badge'
import { ErrorState } from '../ErrorState/ErrorState'
import { IconButton } from '../IconButton/IconButton'
import { IfevalRuleChecklist } from '../IfevalRuleChecklist/IfevalRuleChecklist'
import { SampleDetail } from '../SampleDetail/SampleDetail'
import { outcomeBadge } from '../SampleList/SampleList.helper'
import { Skeleton } from '../Skeleton/Skeleton'
import { Tooltip } from '../Tooltip/Tooltip'

interface SamplePanelProps {
  runId: number
  sampleKey: string
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
  previousDisabled: boolean
  nextDisabled: boolean
  // Why Prev/Next are disabled when it's not simply "no more results in
  // that direction" -- the open sample fell off the currently loaded
  // page (a filter changed while the panel stayed open). `null` for the
  // ordinary end-of-results case, which the component words itself.
  navigationNote: string | null
}

// The Samples tab's own master-detail panel: one sample, fully
// explained, without ever leaving the list. Prev/Next (and the tab's
// own `j`/`k` shortcuts) move between samples by changing the
// :sampleKey route param, which just remounts this component's own
// useRunSample query for the new key -- no state here needs to be
// reset by hand.
export function SamplePanel({
  runId,
  sampleKey,
  onClose,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
  navigationNote,
}: SamplePanelProps) {
  const location = useLocation()
  const sample = useRunSample(runId, sampleKey)
  const badge = sample.data ? outcomeBadge(sample.data.passed) : null
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Moves focus to this panel's own heading every time it opens or
  // steps to a different sample -- a keyboard or screen-reader user
  // who just triggered a navigation shouldn't have to hunt for where
  // the page changed. Runs on mount too (the panel's first open), not
  // just on later sampleKey changes, since useEffect always fires
  // after the first render.
  useEffect(() => {
    headingRef.current?.focus()
  }, [sampleKey])

  return (
    <section aria-labelledby="sample-panel-heading" className="rounded-lg border border-border bg-card p-4">
      {/* Only meaningful below the xl breakpoint, where the list is
          hidden while the panel is open -- below that breakpoint, the
          same route just renders full width there instead of a
          separate one. */}
      <Link
        to={{ pathname: paths.runSamples(runId), search: location.search }}
        className="mb-3 inline-block text-sm text-primary hover:underline xl:hidden"
      >
        ← Back to samples
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2
            id="sample-panel-heading"
            ref={headingRef}
            tabIndex={-1}
            className="font-mono text-sm text-foreground focus:outline-none"
          >
            {sampleKey}
          </h2>
          {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content={previousDisabled ? (navigationNote ?? 'No earlier sample') : 'Previous sample (k)'}>
            <IconButton
              aria-label="Previous sample"
              size="sm"
              aria-disabled={previousDisabled}
              onClick={() => {
                if (!previousDisabled) onPrevious()
              }}
              className={cn(previousDisabled && 'cursor-not-allowed opacity-50')}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Tooltip content={nextDisabled ? (navigationNote ?? 'No later sample') : 'Next sample (j)'}>
            <IconButton
              aria-label="Next sample"
              size="sm"
              aria-disabled={nextDisabled}
              onClick={() => {
                if (!nextDisabled) onNext()
              }}
              className={cn(nextDisabled && 'cursor-not-allowed opacity-50')}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <IconButton aria-label="Close sample panel" size="sm" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {sample.isLoading && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {sample.isError && isNotFoundError(sample.error) && (
        <p className="mt-4 text-sm text-muted-foreground">No sample found with key "{sampleKey}" on this run.</p>
      )}

      {sample.isError && !isNotFoundError(sample.error) && (
        <div className="mt-4">
          <ErrorState message="Could not load this sample" details={String(sample.error)} onRetry={() => sample.refetch()} />
        </div>
      )}

      {sample.data && (
        <>
          <SampleDetail sample={sample.data} />
          <IfevalRuleChecklist rules={sample.data.rules} />
        </>
      )}
    </section>
  )
}
