import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import type { RunDetail } from '../api/client'
import { useRunComparisons } from '../api/queries/runDiagnostics'
import { useRunsById } from '../api/queries/runs'
import { useStandards } from '../api/queries/standards'
import { CompareAddRunDialog } from '../components/CompareAddRunDialog/CompareAddRunDialog'
import { Card } from '../components/Card/Card'
import { CompareFlippedSamples } from '../components/CompareFlippedSamples/CompareFlippedSamples'
import { CompareHeader } from '../components/CompareHeader/CompareHeader'
import { CompareSampleDialog } from '../components/CompareSampleDialog/CompareSampleDialog'
import { CompareScoreMatrix } from '../components/CompareScoreMatrix/CompareScoreMatrix'
import { CompareSetupCheck } from '../components/CompareSetupCheck/CompareSetupCheck'
import { CompareSkeleton } from '../components/CompareSkeleton/CompareSkeleton'
import { CompareStartState } from '../components/CompareStartState/CompareStartState'
import { ComparisonBucketTable } from '../components/ComparisonBucketTable/ComparisonBucketTable'
import { benchmarkDisplayName } from '../utils/benchmarkDisplayName'
import { buildComparePairStates } from '../utils/compareRuns'
import { MAX_COMPARE_RUNS } from '../utils/compareTray'
import { paths } from '../utils/paths'
import {
  classifyProblemRun,
  describeProblemRun,
  parseCompareRunIds,
  parseFlipsRunId,
  resolveCompareRedirect,
  type ProblemRun,
} from './ComparePage.helper'

// N-way compare on one benchmark, driven entirely by the canonical
// ?runs= URL -- 2-4 run ids, first = baseline. Replaces the old
// exactly-two ?left=&right= page; FlipList and ComparisonBucketTable's
// own join logic are kept, restyled and now merged across every
// non-baseline run instead of rendered for a single pair.
export function ComparePage() {
  const [searchParams] = useSearchParams()
  const redirectTo = resolveCompareRedirect(searchParams)

  if (redirectTo !== null) {
    return <Navigate to={redirectTo} replace />
  }

  const runIds = parseCompareRunIds(searchParams)

  if (runIds.length < 2) {
    return <CompareStartState presetRunIds={runIds} />
  }

  return <ComparisonView runIds={runIds} />
}

interface ComparisonViewProps {
  runIds: number[]
}

// Not exported -- ComparePage's own "there are 2-4 candidate run ids"
// branch, kept as a second function in this file rather than a
// component folder: it is this page's entire body, not something a
// second route would ever mount (src/pages/ stays flat per
// .cursor/rules/frontend-components.mdc; this mirrors the old
// ComparePage.tsx's own local ComparisonResult function).
function ComparisonView({ runIds }: ComparisonViewProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const runQueries = useRunsById(runIds)
  const standards = useStandards()
  const [addRunDialogOpen, setAddRunDialogOpen] = useState(false)

  const stillLoading = runQueries.some((query) => query.isLoading)

  // Classified only once every run has settled -- while any is still
  // loading, both lists stay empty and the hooks below fire with no
  // ids, rather than acting on a partial read.
  const problems: ProblemRun[] = []
  const usableRuns: RunDetail[] = []
  if (!stillLoading) {
    runIds.forEach((runId, index) => {
      const problem = classifyProblemRun(runId, runQueries[index])
      if (problem) {
        problems.push(problem)
        return
      }
      const data = runQueries[index].data
      if (data) {
        usableRuns.push(data)
      }
    })
  }

  const baseline = usableRuns[0] ?? null
  const otherRuns = usableRuns.slice(1)
  const otherRunIds = otherRuns.map((run) => run.id)
  // Every hook above and below this line runs on every render, in the
  // same order, regardless of loading state or how many runs turned
  // out usable -- `otherRunIds` is simply `[]` until there is
  // something real to compare, which keeps this call from firing any
  // request early, with no separate "enabled" flag needed.
  const comparisonResults = useRunComparisons(baseline?.id ?? 0, otherRunIds)
  const pairs = buildComparePairStates(otherRuns, comparisonResults)

  function handleRemove(runId: number): void {
    navigate(paths.compare(runIds.filter((id) => id !== runId)))
  }
  function handleMakeBaseline(runId: number): void {
    navigate(paths.compare([runId, ...runIds.filter((id) => id !== runId)]))
  }
  function handleAddRunConfirm(newRunIds: number[]): void {
    navigate(paths.compare([...runIds, ...newRunIds]))
  }
  // flips/level are filter-like edits (replace); opening/closing the
  // sample dialog is real navigation (push) -- the same split
  // RunSamplesTab's own openSample/updateFilters already draws.
  function handleFlipsChange(runId: number): void {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('flips', String(runId))
        return next
      },
      { replace: true },
    )
  }
  function handleLevelChange(level: string): void {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('level', level)
        return next
      },
      { replace: true },
    )
  }
  function handleOpenSample(sampleKey: string): void {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('sample', sampleKey)
      return next
    })
  }
  function handleCloseSample(): void {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('sample')
      return next
    })
  }

  if (stillLoading) {
    return <CompareSkeleton />
  }

  // Too few of the runs already in the URL turned out usable (unknown
  // id, not yet finished, or a request error) -- fall back to picking
  // fresh ones rather than rendering a comparison with nothing in it.
  if (baseline === null || usableRuns.length < 2) {
    return (
      <div className="space-y-4">
        {problems.length > 0 && <ProblemRunsNotice problems={problems} onRemove={handleRemove} />}
        <CompareStartState presetRunIds={usableRuns.map((run) => run.id)} />
      </div>
    )
  }

  const benchmarkName = benchmarkDisplayName(baseline.benchmark, standards.data ?? [])
  const openSampleKey = searchParams.get('sample')
  const level = searchParams.get('level')
  const flipsRunId = parseFlipsRunId(searchParams)

  return (
    <div className="space-y-6">
      <CompareHeader
        benchmarkDisplayName={benchmarkName}
        runs={usableRuns}
        canAddRun={runIds.length < MAX_COMPARE_RUNS}
        onMakeBaseline={handleMakeBaseline}
        onRemove={handleRemove}
        onAddRun={() => setAddRunDialogOpen(true)}
      />

      {problems.length > 0 && <ProblemRunsNotice problems={problems} onRemove={handleRemove} />}

      <CompareSetupCheck runs={usableRuns} />
      <CompareScoreMatrix baseline={baseline} pairs={pairs} />
      <ComparisonBucketTable otherRuns={otherRuns} pairs={pairs} level={level} onLevelChange={handleLevelChange} />
      <CompareFlippedSamples
        baseline={baseline}
        otherRuns={otherRuns}
        pairs={pairs}
        selectedRunId={flipsRunId}
        onSelectedRunChange={handleFlipsChange}
        onOpenSample={handleOpenSample}
      />

      <CompareAddRunDialog
        open={addRunDialogOpen}
        onOpenChange={setAddRunDialogOpen}
        benchmark={baseline.benchmark}
        benchmarkDisplayName={benchmarkName}
        excludeRunIds={runIds}
        remainingSlots={MAX_COMPARE_RUNS - runIds.length}
        onConfirm={handleAddRunConfirm}
      />

      {openSampleKey !== null && (
        <CompareSampleDialog runs={usableRuns} sampleKey={openSampleKey} onClose={handleCloseSample} />
      )}
    </div>
  )
}

interface ProblemRunsNoticeProps {
  problems: ProblemRun[]
  onRemove: (runId: number) => void
}

// Not exported -- one run id in ?runs= that didn't resolve to a
// usable run (unknown, not finished, or a load error), with a Remove
// action that rewrites the URL the same way the header's own Remove
// menu item does.
function ProblemRunsNotice({ problems, onRemove }: ProblemRunsNoticeProps) {
  return (
    <Card className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium text-warning">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {problems.length === 1 ? '1 run needs attention' : `${problems.length} runs need attention`}
      </p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {problems.map((problem) => (
          <li key={problem.runId} className="flex items-center justify-between gap-3">
            <span>{describeProblemRun(problem)}</span>
            <button
              type="button"
              onClick={() => onRemove(problem.runId)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
