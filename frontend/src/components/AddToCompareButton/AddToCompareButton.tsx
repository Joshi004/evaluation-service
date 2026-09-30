import { Check, Plus } from 'lucide-react'
import { useStandards } from '../../api/queries/standards'
import { benchmarkDisplayName } from '../../utils/benchmarkDisplayName'
import { cn } from '../../utils/cn'
import { findPinRefusal, type CompareCandidate } from '../../utils/compareTray'
import { useCompareTray } from '../../utils/useCompareTray'
import { IconButton } from '../IconButton/IconButton'
import { Tooltip } from '../Tooltip/Tooltip'
import { addToCompareAriaLabel, addToCompareTooltip } from './AddToCompareButton.helper'

interface AddToCompareButtonProps {
  candidate: CompareCandidate
  className?: string
}

// The pin control shown on every run row -- Runs today; the
// Leaderboard and Model page add their own call sites too. A refused
// pin stays focusable and hoverable rather than using the native
// `disabled` attribute, which would hide the
// reason from exactly the person who needs to read it: mouse hover and
// keyboard focus both still open the tooltip, only the click is a
// no-op (`aria-disabled`, not `disabled`).
export function AddToCompareButton({ candidate, className }: AddToCompareButtonProps) {
  const { pinnedRuns, isPinned, pinRun, unpinRun } = useCompareTray()
  const standards = useStandards()

  const pinned = isPinned(candidate.runId)
  const refusal = pinned ? null : findPinRefusal(pinnedRuns, candidate)

  // Only meaningful for an 'other-benchmark' refusal ("...you are
  // comparing IFEval"), but resolved unconditionally: hooks can't run
  // behind an `if`, and /standards is already cached by the time a
  // second run exists to refuse against.
  const trayBenchmark = pinnedRuns.length > 0 ? pinnedRuns[0].benchmark : candidate.benchmark
  const trayBenchmarkName = benchmarkDisplayName(trayBenchmark, standards.data ?? [])

  function handleClick(): void {
    if (pinned) {
      unpinRun(candidate.runId)
    } else if (refusal === null) {
      pinRun(candidate)
    }
  }

  return (
    <Tooltip content={addToCompareTooltip(pinned, refusal, trayBenchmarkName)}>
      <IconButton
        variant={pinned ? 'primary' : 'ghost'}
        size="sm"
        aria-label={addToCompareAriaLabel(pinned, candidate.runId)}
        aria-pressed={pinned}
        aria-disabled={refusal !== null}
        onClick={handleClick}
        className={cn('aria-disabled:cursor-not-allowed aria-disabled:opacity-50', className)}
      >
        {pinned ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </IconButton>
    </Tooltip>
  )
}
