import type { RunComparison, RunDetail } from '../../api/client'
import type { ComparePairState } from '../../utils/compareRuns'
import { ErrorState } from '../ErrorState/ErrorState'
import { FlipList } from '../FlipList/FlipList'
import { hasMultipleSubsets } from '../FlipList/FlipList.helper'
import { ModelName } from '../ModelName/ModelName'
import { SegmentedControl } from '../SegmentedControl/SegmentedControl'
import { Skeleton } from '../Skeleton/Skeleton'
import { flipCountsSummaryText, resolveFlipsRunId } from './CompareFlippedSamples.helper'

interface CompareFlippedSamplesProps {
  baseline: RunDetail
  otherRuns: RunDetail[]
  pairs: ComparePairState[]
  // Raw from the URL's ?flips= -- may be null or name a run no longer
  // in the comparison; resolved to a real selection internally.
  selectedRunId: number | null
  onSelectedRunChange: (runId: number) => void
  onOpenSample: (sampleKey: string) => void
}

// §8.8 item 6: which samples flipped between the baseline and one
// other run at a time -- a run selector when there is more than one
// non-baseline run, hidden entirely when there is only one pair.
export function CompareFlippedSamples({
  baseline,
  otherRuns,
  pairs,
  selectedRunId,
  onSelectedRunChange,
  onOpenSample,
}: CompareFlippedSamplesProps) {
  const effectiveRunId = resolveFlipsRunId(selectedRunId, otherRuns)
  const pair = pairs.find((candidate) => candidate.run.id === effectiveRunId)

  if (!pair) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Flipped samples</h2>
        {otherRuns.length > 1 && (
          <SegmentedControl
            value={String(effectiveRunId)}
            onValueChange={(value) => onSelectedRunChange(Number(value))}
            options={otherRuns.map((run) => ({ value: String(run.id), label: `vs #${run.id}` }))}
            aria-label="Compare against"
          />
        )}
      </div>

      {pair.status === 'loading' && <Skeleton className="h-24 w-full" />}

      {pair.status === 'error' && (
        <ErrorState
          message={`Could not compare run #${pair.run.id}`}
          details={pair.errorMessage ?? undefined}
          onRetry={pair.refetch}
        />
      )}

      {pair.status === 'loaded' && pair.comparison && !pair.comparison.comparable && (
        <p className="text-sm text-muted-foreground">
          {pair.comparison.refusal_reason ?? 'These runs cannot be compared.'}
        </p>
      )}

      {pair.status === 'loaded' && pair.comparison && pair.comparison.comparable && (
        <CompareFlippedSamplesBody
          baseline={baseline}
          otherRun={pair.run}
          comparison={pair.comparison}
          onOpenSample={onOpenSample}
        />
      )}
    </div>
  )
}

interface CompareFlippedSamplesBodyProps {
  baseline: RunDetail
  otherRun: RunDetail
  comparison: RunComparison
  onOpenSample: (sampleKey: string) => void
}

// Not exported -- only rendered once a comparable comparison has
// actually loaded; every other state is handled by the parent above.
function CompareFlippedSamplesBody({ baseline, otherRun, comparison, onOpenSample }: CompareFlippedSamplesBodyProps) {
  const showSubsetColumn = hasMultipleSubsets(comparison.fail_to_pass, comparison.pass_to_fail)

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        <ModelName name={baseline.checkpoint_name} /> vs <ModelName name={otherRun.checkpoint_name} />
      </p>
      <p className="text-sm text-muted-foreground">{flipCountsSummaryText(comparison)}</p>
      <FlipList
        direction="fail_to_pass"
        samples={comparison.fail_to_pass}
        baselineRunId={baseline.id}
        otherRunId={otherRun.id}
        showSubsetColumn={showSubsetColumn}
        onOpenSample={onOpenSample}
      />
      <FlipList
        direction="pass_to_fail"
        samples={comparison.pass_to_fail}
        baselineRunId={baseline.id}
        otherRunId={otherRun.id}
        showSubsetColumn={showSubsetColumn}
        onOpenSample={onOpenSample}
      />
    </div>
  )
}
