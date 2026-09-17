import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { apiFetch, type ComparisonSide, type RunComparison, type RunListItem } from '../api/client'
import { ComparisonBucketTable } from '../components/ComparisonBucketTable/ComparisonBucketTable'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { FlipList } from '../components/FlipList/FlipList'
import {
  deltaText,
  hasMultipleSubsets,
  parseCompareParams,
  runPickerLabel,
  sideConfidenceIntervalText,
  sideScoreText,
  significanceClassName,
  significanceText,
  sortRunsForPicker,
  toCompareParams,
} from './ComparePage.helper'

// Phase 9 (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md): its own page
// comparing two runs, reachable from the leaderboard's two-cell
// selection and from a run's diagnostics page. Linkable via
// ?left=&right= so a comparison can be pasted into Slack the same way
// Phase 4's sample rows already are.
export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { left, right } = parseCompareParams(searchParams)

  // Only finished runs have a diagnostics file to join -- offering
  // anything else in the picker would just trade one obvious 409 for
  // another.
  const runs = useQuery({
    queryKey: ['runs', 'done'],
    queryFn: () => apiFetch<RunListItem[]>('/runs?status=done'),
  })

  const comparison = useQuery({
    queryKey: ['run-comparison', left, right],
    queryFn: () => apiFetch<RunComparison>(`/runs/${left}/compare/${right}`),
    enabled: left !== null && right !== null,
    // A 404 (unknown run) or 409 (not finished) won't succeed on a
    // third attempt -- retrying would only delay the error state.
    retry: false,
  })

  function handleLeftChange(value: string) {
    setSearchParams(toCompareParams({ left: value === '' ? null : Number(value), right }))
  }

  function handleRightChange(value: string) {
    setSearchParams(toCompareParams({ left, right: value === '' ? null : Number(value) }))
  }

  const pickerRuns = runs.data ? sortRunsForPicker(runs.data) : []

  return (
    <div>
      <h1 className="text-2xl font-semibold">Compare runs</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Two runs, joined on sample key. The flip lists below are the actual diff of whatever changed
        between them.
      </p>

      {runs.isError && (
        <p className="mt-4 text-sm text-red-400">Could not load runs: {String(runs.error)}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-4">
        <RunPicker label="Left" value={left} runs={pickerRuns} onChange={handleLeftChange} />
        <RunPicker label="Right" value={right} runs={pickerRuns} onChange={handleRightChange} />
      </div>

      {(left === null || right === null) && (
        <div className="mt-6">
          <EmptyState message="Pick two runs to compare." />
        </div>
      )}

      {left !== null && right !== null && comparison.isLoading && (
        <p className="mt-6 text-sm text-slate-500">Comparing…</p>
      )}

      {left !== null && right !== null && comparison.isError && (
        <p className="mt-6 text-sm text-red-400">
          Could not compare these runs: {String(comparison.error)}
        </p>
      )}

      {comparison.data && <ComparisonResult comparison={comparison.data} />}
    </div>
  )
}

interface RunPickerProps {
  label: string
  value: number | null
  runs: RunListItem[]
  onChange: (value: string) => void
}

// Not exported -- both pickers are identical, kept local because
// nothing outside this file renders one on its own.
function RunPicker({ label, value, runs, onChange }: RunPickerProps) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-72 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
      >
        <option value="">Select a run…</option>
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {runPickerLabel(run)}
          </option>
        ))}
      </select>
    </label>
  )
}

interface ComparisonResultProps {
  comparison: RunComparison
}

// Not exported -- the score cards, refusal state, flip lists and
// bucket-delta table, all driven by one already-loaded RunComparison.
function ComparisonResult({ comparison }: ComparisonResultProps) {
  const showSubsetColumn = hasMultipleSubsets(comparison.fail_to_pass, comparison.pass_to_fail)

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ScoreCard side={comparison.left} />
        <ScoreCard side={comparison.right} />
      </div>

      {comparison.delta && (
        <p className="mt-3 text-sm">
          <span className={significanceClassName(comparison.delta)}>
            {deltaText(comparison.delta)}
          </span>{' '}
          <span className="text-xs text-slate-500">({significanceText(comparison.delta)})</span>
        </p>
      )}

      <p className="mt-2 text-xs text-slate-500">
        {comparison.overlap.n_shared} shared samples
        {comparison.overlap.left_only > 0 && `, ${comparison.overlap.left_only} only in the left run`}
        {comparison.overlap.right_only > 0 &&
          `, ${comparison.overlap.right_only} only in the right run`}
      </p>

      {!comparison.comparable && (
        <div className="mt-4">
          <EmptyState message={comparison.refusal_reason ?? 'These runs cannot be compared.'} />
        </div>
      )}

      {comparison.comparable && (
        <>
          <p className="mt-4 text-sm text-slate-300">
            {comparison.unchanged_passed} unchanged passing · {comparison.unchanged_failed} unchanged
            failing
          </p>

          <FlipList
            direction="fail_to_pass"
            samples={comparison.fail_to_pass}
            leftRunId={comparison.left.eval_run_id}
            rightRunId={comparison.right.eval_run_id}
            showSubsetColumn={showSubsetColumn}
          />
          <FlipList
            direction="pass_to_fail"
            samples={comparison.pass_to_fail}
            leftRunId={comparison.left.eval_run_id}
            rightRunId={comparison.right.eval_run_id}
            showSubsetColumn={showSubsetColumn}
          />

          {comparison.bucket_deltas.length > 0 && (
            <ComparisonBucketTable deltas={comparison.bucket_deltas} />
          )}
        </>
      )}
    </div>
  )
}

interface ScoreCardProps {
  side: ComparisonSide
}

// Not exported -- one run's own identity and score, rendered twice
// (left, right) side by side.
function ScoreCard({ side }: ScoreCardProps) {
  const confidenceIntervalText = sideConfidenceIntervalText(side)

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <Link to={`/runs/${side.eval_run_id}`} className="text-sm text-blue-400 hover:underline">
        Run #{side.eval_run_id}
      </Link>
      <p className="mt-1 text-xs text-slate-500">
        {side.benchmark} · {side.served_model_name}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{sideScoreText(side)}</p>
      <p className="text-xs text-slate-500">{side.primary_metric_display_name}</p>
      {confidenceIntervalText && <p className="mt-1 text-xs text-slate-500">{confidenceIntervalText}</p>}
      <p className="mt-2 text-sm text-slate-300">
        {side.passed} of {side.n_samples} passed · {side.failed} failed
      </p>
    </div>
  )
}