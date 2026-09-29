import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  runSamplesQueryOptions,
  SAMPLE_PAGE_SIZE,
  useRunSamples,
  type SampleListFilters,
} from '../api/queries/runDiagnostics'
import { Button } from '../components/Button/Button'
import { Card } from '../components/Card/Card'
import { DiagnosticsSummary } from '../components/DiagnosticsSummary/DiagnosticsSummary'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { FailureBreakdown } from '../components/FailureBreakdown/FailureBreakdown'
import { SampleFilters } from '../components/SampleFilters/SampleFilters'
import { SampleList } from '../components/SampleList/SampleList'
import { SamplePanel } from '../components/SamplePanel/SamplePanel'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { cn } from '../utils/cn'
import { paths } from '../utils/paths'
import { useRunReport } from './RunReportPage.helper'
import {
  buildRangeText,
  parseSampleFilters,
  resolveSampleStep,
  shouldIgnoreShortcut,
  toSearchParams,
  type SampleStep,
} from './RunSamplesTab.helper'

// The Samples tab (docs/UI_REDESIGN_PLAN.md §8.7, item 4): merges the
// old RunDiagnosticsPage (filters, breakdown, list) with RunSamplePage
// (one sample, fully explained) into one master-detail view. Both
// `/runs/:id/samples` and `/runs/:id/samples/:sampleKey` mount this same
// component -- the optional :sampleKey is what decides whether the
// panel renders at all, not a second route or a nested outlet.
export function RunSamplesTab() {
  const { run, diagnostics } = useRunReport()
  const { sampleKey } = useParams<{ sampleKey?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [breakdownExpanded, setBreakdownExpanded] = useState(false)
  const [isStepping, setIsStepping] = useState(false)

  const filters = parseSampleFilters(searchParams)
  const samples = useRunSamples(run.id, filters)

  // Filter edits stay on whichever path we're already on (the bare list,
  // or a sample's own panel) and only rewrite the query string -- a
  // filter change must never itself close an open panel (the panel can
  // still show whatever is currently open; only its Prev/Next degrade
  // if the new filter no longer includes it). `replace`, per §4.5's own
  // "replace for filter edits, push for navigation" rule.
  function updateFilters(next: SampleListFilters): void {
    const query = toSearchParams(next).toString()
    navigate({ pathname: location.pathname, search: query }, { replace: true })
  }

  function handleRuleChange(rule: string | null): void {
    updateFilters({ ...filters, rule, offset: 0 })
  }
  function handleTagChange(tag: string | null): void {
    updateFilters({ ...filters, tag, offset: 0 })
  }
  function handlePreviousPage(): void {
    updateFilters({ ...filters, offset: Math.max(0, filters.offset - SAMPLE_PAGE_SIZE) })
  }
  function handleNextPage(): void {
    updateFilters({ ...filters, offset: filters.offset + SAMPLE_PAGE_SIZE })
  }

  // Opening, stepping between and closing a sample are real navigation
  // (§4.5: "push for navigation") -- Back steps through what was
  // actually viewed, one sample at a time.
  function openSample(key: string, offsetOverride?: number): void {
    const nextFilters = offsetOverride === undefined ? filters : { ...filters, offset: offsetOverride }
    const query = toSearchParams(nextFilters).toString()
    navigate({ pathname: paths.runSample(run.id, key), search: query })
  }
  function closeSample(): void {
    const query = toSearchParams(filters).toString()
    navigate({ pathname: paths.runSamples(run.id), search: query })
  }

  async function handleStep(step: SampleStep): Promise<void> {
    if (step.kind === 'same-page') {
      openSample(step.sampleKey)
      return
    }
    if (step.kind !== 'other-page') {
      return
    }
    setIsStepping(true)
    try {
      const page = await queryClient.query(runSamplesQueryOptions(run.id, { ...filters, offset: step.offset }))
      const targetKey = step.position === 'first' ? page.items[0]?.sample_key : page.items.at(-1)?.sample_key
      if (targetKey !== undefined) {
        openSample(targetKey, step.offset)
      }
    } catch {
      // A network failure fetching the next/previous page: the button
      // simply doesn't navigate. useRunSamples already surfaces the
      // same failure with a Retry if the user instead pages there with
      // Previous/Next, so this rare case isn't left with no recovery.
    } finally {
      setIsStepping(false)
    }
  }

  const total = samples.data?.total ?? 0
  const shownCount = samples.data?.items.length ?? 0
  const showSubsetColumn = (diagnostics.data?.summary.subsets.length ?? 0) > 1

  const previousStep: SampleStep =
    sampleKey !== undefined && samples.data
      ? resolveSampleStep('previous', samples.data.items, sampleKey, filters.offset, samples.data.total, SAMPLE_PAGE_SIZE)
      : { kind: 'unavailable' }
  const nextStep: SampleStep =
    sampleKey !== undefined && samples.data
      ? resolveSampleStep('next', samples.data.items, sampleKey, filters.offset, samples.data.total, SAMPLE_PAGE_SIZE)
      : { kind: 'unavailable' }
  const sampleNotOnPage =
    sampleKey !== undefined &&
    samples.data !== undefined &&
    samples.data.items.every((item) => item.sample_key !== sampleKey)
  const navigationNote = sampleNotOnPage ? "This sample isn't on the current page of results." : null

  // `j`/`k` step between samples (opening the first row if none is open
  // yet); `Esc` closes. Ignored while typing, with a modifier held, or
  // once some other handler already claimed the keystroke.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (shouldIgnoreShortcut(event)) {
        return
      }
      if (event.key === 'Escape') {
        if (sampleKey !== undefined) {
          closeSample()
        }
        return
      }
      if (event.key !== 'j' && event.key !== 'k') {
        return
      }
      if (sampleKey === undefined) {
        const firstKey = samples.data?.items[0]?.sample_key
        if (firstKey !== undefined) {
          openSample(firstKey)
        }
        return
      }
      void handleStep(event.key === 'j' ? nextStep : previousStep)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // Re-subscribes whenever the values the handler actually reads
    // change, so it never closes over a stale sampleKey/step -- the
    // handler functions themselves are recreated every render anyway
    // (they close over `filters`/`navigate`), so listing them here would
    // only make that explicit, not change when the effect re-runs.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey, samples.data, previousStep, nextStep])

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className={cn('space-y-4', sampleKey !== undefined && 'hidden xl:block')}>
        {diagnostics.isLoading && <Skeleton className="h-10 w-full" />}
        {diagnostics.isError && (
          <ErrorState
            message="Could not load this run's diagnostics"
            details={String(diagnostics.error)}
            onRetry={() => diagnostics.refetch()}
          />
        )}

        {diagnostics.data && (
          <>
            <SampleFilters filters={filters} subsets={diagnostics.data.summary.subsets} onChange={updateFilters} />

            <Card>
              <DiagnosticsSummary
                summary={diagnostics.data.summary}
                activeTag={filters.tag}
                onTagChange={handleTagChange}
              />
            </Card>

            <div className="rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setBreakdownExpanded((value) => !value)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium text-foreground">Breakdown</span>
                <ChevronDown
                  className={cn('h-4 w-4 text-muted-foreground transition-transform', breakdownExpanded && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
              {breakdownExpanded && (
                <div className="border-t border-border p-4">
                  <FailureBreakdown
                    buckets={diagnostics.data.buckets}
                    instructionLevel={diagnostics.data.summary.instruction_level}
                    metrics={diagnostics.data.summary.metrics}
                    activeRule={filters.rule}
                    onRuleChange={handleRuleChange}
                  />
                </div>
              )}
            </div>

            <div>
              {samples.isLoading && <Skeleton className="h-64 w-full" />}
              {samples.isError && (
                <ErrorState
                  message="Could not load samples"
                  details={String(samples.error)}
                  onRetry={() => samples.refetch()}
                />
              )}
              {samples.data && total === 0 && <EmptyState message="No samples match this filter" />}
              {samples.data && total > 0 && (
                <>
                  <SampleList
                    runId={run.id}
                    samples={samples.data.items}
                    primaryMetricName={diagnostics.data.summary.primary_metric_name}
                    primaryMetricDisplayName={diagnostics.data.summary.primary_metric_display_name}
                    showSubsetColumn={showSubsetColumn}
                    selectedSampleKey={sampleKey ?? null}
                    compact={sampleKey !== undefined}
                  />
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{buildRangeText(total, filters.offset, shownCount)}</span>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" disabled={filters.offset === 0} onClick={handlePreviousPage}>
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={filters.offset + shownCount >= total}
                        onClick={handleNextPage}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {sampleKey !== undefined && (
        <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto">
          <SamplePanel
            runId={run.id}
            sampleKey={sampleKey}
            onClose={closeSample}
            onPrevious={() => void handleStep(previousStep)}
            onNext={() => void handleStep(nextStep)}
            previousDisabled={isStepping || previousStep.kind === 'unavailable'}
            nextDisabled={isStepping || nextStep.kind === 'unavailable'}
            navigationNote={navigationNote}
          />
        </div>
      )}
    </div>
  )
}
