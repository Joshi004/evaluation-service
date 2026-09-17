import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { apiFetch, type RunDiagnostics, type SamplePage } from '../api/client'
import { DiagnosticsSummary } from '../components/DiagnosticsSummary/DiagnosticsSummary'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { FailureBreakdown } from '../components/FailureBreakdown/FailureBreakdown'
import { SampleFilters } from '../components/SampleFilters/SampleFilters'
import { SampleList } from '../components/SampleList/SampleList'
import {
  buildRangeText,
  buildSamplesPath,
  parseSampleFilters,
  SAMPLE_PAGE_SIZE,
  toSearchParams,
  type SampleListFilters,
} from './RunDiagnosticsPage.helper'

// Layer 4 (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 4): every
// sample in a run, filtered and paged server-side, defaulting to
// failures only. Two queries, not one -- GET /diagnostics gives the
// header identity, the primary metric name, and the subset list for
// the filter row; GET /samples gives the filtered page. The samples
// endpoint deliberately never returns a summary (Section 3.5), so both
// are needed.
export function RunDiagnosticsPage() {
  const { runId } = useParams<{ runId: string }>()
  const id = Number(runId)
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseSampleFilters(searchParams)

  const diagnostics = useQuery({
    queryKey: ['run-diagnostics', id],
    queryFn: () => apiFetch<RunDiagnostics>(`/runs/${id}/diagnostics`),
    enabled: Number.isFinite(id),
  })

  const samples = useQuery({
    queryKey: ['run-samples', id, filters],
    queryFn: () => apiFetch<SamplePage>(buildSamplesPath(id, filters)),
    enabled: Number.isFinite(id),
    // Keeps the previous page's rows on screen while a filter change or
    // a page turn is in flight, instead of flashing an empty table.
    placeholderData: keepPreviousData,
  })

  if (!Number.isFinite(id)) {
    return <p className="text-sm text-red-400">Invalid run id.</p>
  }

  function handleFiltersChange(next: SampleListFilters) {
    setSearchParams(toSearchParams(next))
  }

  // Clicking a rule row in FailureBreakdown (Phase 6) sets the sample
  // list's `rule` filter through the same URL state Phase 4
  // established. Resets `offset` for the same reason every other
  // filter change does -- a filter change must never leave the pager
  // on a page that no longer exists.
  function handleRuleChange(rule: string | null) {
    handleFiltersChange({ ...filters, rule, offset: 0 })
  }

  // Clicking a tag chip in DiagnosticsSummary (Phase 8) sets the
  // sample list's `tag` filter the same way -- through URL state, with
  // `offset` reset for the same reason every other filter change does.
  function handleTagChange(tag: string | null) {
    handleFiltersChange({ ...filters, tag, offset: 0 })
  }

  function handlePrevious() {
    handleFiltersChange({ ...filters, offset: Math.max(0, filters.offset - SAMPLE_PAGE_SIZE) })
  }

  function handleNext() {
    handleFiltersChange({ ...filters, offset: filters.offset + SAMPLE_PAGE_SIZE })
  }

  const total = samples.data?.total ?? 0
  const shownCount = samples.data?.items.length ?? 0
  const showSubsetColumn = (diagnostics.data?.summary.subsets.length ?? 0) > 1

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link to={`/runs/${id}`} className="text-sm text-blue-400 hover:underline">
          ← Back to run #{id}
        </Link>
        {/* Phase 9's entry point onto compare mode -- lands with this
            run pre-filled as the left side; the compare page's own
            picker fills in the other side. */}
        <Link to={`/compare?left=${id}`} className="text-sm text-blue-400 hover:underline">
          Compare with…
        </Link>
      </div>

      {diagnostics.isLoading && <p className="mt-4 text-sm text-slate-500">Loading diagnostics…</p>}

      {diagnostics.isError && (
        <p className="mt-4 text-sm text-red-400">
          Could not load diagnostics: {String(diagnostics.error)}
        </p>
      )}

      {diagnostics.data && (
        <>
          {/* Repeats the run's identity and primary score so the page
              stands alone when deep-linked (Phase 4's own wording). */}
          <h1 className="mt-2 text-2xl font-semibold">
            Run #{diagnostics.data.source.eval_run_id} diagnostics
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {diagnostics.data.source.benchmark} · {diagnostics.data.source.served_model_name}
          </p>
          <p className="mt-1 text-sm text-slate-200">
            {diagnostics.data.summary.primary_metric_display_name} —{' '}
            {diagnostics.data.summary.passed} passed, {diagnostics.data.summary.failed} failed of{' '}
            {diagnostics.data.summary.n_samples} samples
          </p>

          <DiagnosticsSummary
            summary={diagnostics.data.summary}
            activeTag={filters.tag}
            onTagChange={handleTagChange}
          />

          <FailureBreakdown
            buckets={diagnostics.data.buckets}
            instructionLevel={diagnostics.data.summary.instruction_level}
            metrics={diagnostics.data.summary.metrics}
            activeRule={filters.rule}
            onRuleChange={handleRuleChange}
          />

          <div className="mt-6">
            <SampleFilters
              filters={filters}
              subsets={diagnostics.data.summary.subsets}
              onChange={handleFiltersChange}
            />
          </div>

          <div className="mt-4">
            {samples.isLoading && <p className="text-sm text-slate-500">Loading samples…</p>}

            {samples.isError && (
              <p className="text-sm text-red-400">Could not load samples: {String(samples.error)}</p>
            )}

            {samples.data && total === 0 && <EmptyState message="No samples match this filter" />}

            {samples.data && total > 0 && (
              <>
                <SampleList
                  runId={id}
                  samples={samples.data.items}
                  primaryMetricName={diagnostics.data.summary.primary_metric_name}
                  primaryMetricDisplayName={diagnostics.data.summary.primary_metric_display_name}
                  showSubsetColumn={showSubsetColumn}
                />

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    {buildRangeText(total, filters.offset, shownCount)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={filters.offset === 0}
                      onClick={handlePrevious}
                      className="rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={filters.offset + shownCount >= total}
                      onClick={handleNext}
                      className="rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
