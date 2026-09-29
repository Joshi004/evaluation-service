// Non-DOM logic for AddToCompareButton.tsx: the tooltip copy and
// accessible name for each of its three states. Kept out of the
// component body per .cursor/rules/frontend-components.mdc.
import { pinRefusalReason, type PinRefusal } from '../../utils/compareTray'

// `trayBenchmarkName` is only read for an 'other-benchmark' refusal
// ("...you are comparing IFEval"); the caller resolves it
// unconditionally since hooks can't run behind an `if` (see the
// component), so this function just ignores it otherwise.
export function addToCompareTooltip(
  pinned: boolean,
  refusal: PinRefusal | null,
  trayBenchmarkName: string,
): string {
  if (pinned) {
    return 'Remove from compare'
  }
  if (refusal !== null) {
    return pinRefusalReason(refusal, trayBenchmarkName)
  }
  return 'Add to compare'
}

export function addToCompareAriaLabel(pinned: boolean, runId: number): string {
  return pinned ? `Remove run #${runId} from compare` : `Add run #${runId} to compare`
}
