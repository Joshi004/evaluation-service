import type { BenchmarkColumn, SetupOption } from '../../utils/buildLeaderboard'

// Every OTHER setup of this column that also has a result for this
// model -- what the cell's own "+N other setup" chip counts and links
// to (§8.6 item 3: "a subdued '+1 other setup' chip instead of
// hiding"). Never includes the setup currently on screen: that one is
// already the cell's own primary score, not an "other" one.
export function otherSetupsForModel(
  column: BenchmarkColumn,
  checkpointId: number,
  displayedComparisonHash: string,
): SetupOption[] {
  return column.setups.filter(
    (setup) => setup.comparisonHash !== displayedComparisonHash && setup.cellsByCheckpointId[checkpointId] !== undefined,
  )
}

// Written out in full (not built from a template string) so Tailwind's
// build-time scanner actually generates these utilities -- see the
// same note on StyleguidePage.tsx's own swatch classes. Low alpha: the
// tint is a hint, not a replacement for the score text's own contrast
// (§3 rule 12).
export const HEAT_BACKGROUND_CLASSES: Record<number, string> = {
  1: 'bg-heat-1/10',
  2: 'bg-heat-2/10',
  3: 'bg-heat-3/15',
  4: 'bg-heat-4/15',
  5: 'bg-heat-5/20',
}
