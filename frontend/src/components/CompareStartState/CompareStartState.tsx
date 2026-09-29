import { useState } from 'react'
import { Link } from 'react-router'
import { useRuns } from '../../api/queries/runs'
import { useStandards } from '../../api/queries/standards'
import { MAX_COMPARE_RUNS, MIN_COMPARE_RUNS } from '../../utils/compareTray'
import { paths } from '../../utils/paths'
import { Button } from '../Button/Button'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { Card } from '../Card/Card'
import { CompareRunPicker } from '../CompareRunPicker/CompareRunPicker'
import { EmptyState } from '../EmptyState/EmptyState'
import { ErrorState } from '../ErrorState/ErrorState'
import { PageHeader } from '../PageHeader/PageHeader'
import { SelectField } from '../SelectField/SelectField'
import { Skeleton } from '../Skeleton/Skeleton'
import { buildBenchmarkOptions, resolveDefaultBenchmark, runsForBenchmark } from './CompareStartState.helper'

interface CompareStartStateProps {
  presetRunIds: number[]
}

// §8.8 item 8: pick a benchmark, then 2-4 finished runs -- what
// ComparePage renders whenever fewer than MIN_COMPARE_RUNS usable run
// ids are in the URL (a bare /compare, a single preset id, or too few
// usable runs left after ComparisonView's own checks).
export function CompareStartState({ presetRunIds }: CompareStartStateProps) {
  const doneRuns = useRuns({ status: 'done' })
  const standards = useStandards()

  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null)
  const [selectedRunIds, setSelectedRunIds] = useState<number[]>(presetRunIds)
  const [initialized, setInitialized] = useState(false)

  // Adjusts state during render -- the same one-time-correction
  // pattern CompareTrayProvider's own revalidation uses -- since the
  // default benchmark depends on data that isn't there yet on the
  // very first render.
  if (!initialized && doneRuns.data !== undefined) {
    setInitialized(true)
    const options = buildBenchmarkOptions(doneRuns.data, standards.data ?? [])
    setSelectedBenchmark(resolveDefaultBenchmark(doneRuns.data, presetRunIds, options))
  }

  function handleBenchmarkChange(benchmark: string): void {
    setSelectedBenchmark(benchmark)
    setSelectedRunIds([])
  }

  function handleToggle(runId: number): void {
    setSelectedRunIds((current) => {
      if (current.includes(runId)) {
        return current.filter((id) => id !== runId)
      }
      if (current.length >= MAX_COMPARE_RUNS) {
        return current
      }
      return [...current, runId]
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare runs"
        description="Pick a benchmark, then 2–4 finished runs to compare. The first one you pick is the baseline."
      />

      {doneRuns.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {doneRuns.isError && (
        <ErrorState
          message="Could not load runs"
          details={String(doneRuns.error)}
          onRetry={() => doneRuns.refetch()}
        />
      )}

      {doneRuns.data && doneRuns.data.length === 0 && (
        <EmptyState
          title="No finished runs yet"
          description="Register a model, then run an evaluation. Once two runs share a benchmark, you can compare them here."
          actions={
            <Link to={paths.newEvaluation()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
              New evaluation
            </Link>
          }
        />
      )}

      {doneRuns.data && doneRuns.data.length > 0 && (
        <Card className="space-y-4">
          <SelectField
            className="w-64"
            value={selectedBenchmark ?? ''}
            onChange={(event) => handleBenchmarkChange(event.target.value)}
            aria-label="Benchmark"
          >
            {buildBenchmarkOptions(doneRuns.data, standards.data ?? []).map((option) => (
              <option key={option.benchmark} value={option.benchmark}>
                {option.displayName} · {option.count} run{option.count === 1 ? '' : 's'}
              </option>
            ))}
          </SelectField>

          <CompareRunPicker
            runs={runsForBenchmark(doneRuns.data, selectedBenchmark)}
            selectedRunIds={selectedRunIds}
            maxSelectable={MAX_COMPARE_RUNS}
            labelFirstSelectedAsBaseline
            onToggle={handleToggle}
          />

          <div className="flex justify-end">
            {selectedRunIds.length >= MIN_COMPARE_RUNS ? (
              <Link to={paths.compare(selectedRunIds)} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
                Compare
              </Link>
            ) : (
              <Button disabled>Compare</Button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
