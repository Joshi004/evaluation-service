import type { BenchmarkColumn, SetupOption, SetupResult } from '../../utils/buildLeaderboard'

// What a cell's star and rank are measured against: every model's best
// result on the benchmark (Best-score mode), or every model's result on
// one setup (All-setups mode's own sub-columns).
export type RankScope = 'benchmark' | 'setup'

export interface ScoreCellContent {
  // The score on screen and the setup it came from; null when this
  // model has nothing to show here, which renders as a "Run it" link.
  result: SetupResult | null
  // This model's results on the other setups of the benchmark -- what
  // the hover card lists. Empty in All-setups mode, where every setup
  // is already its own visible sub-column.
  otherSetups: SetupResult[]
  rankScope: RankScope
  // The standard a "Run it" link evaluates against.
  runItStandardId: number
}

// The ★'s accessible and tooltip text -- "leads" is only true of the
// scope the rank was computed over, so the wording follows it.
export function leaderStarLabel(rankScope: RankScope, isLeader: boolean): string {
  if (!isLeader) {
    return 'Within margin of error of the leader'
  }
  return rankScope === 'benchmark' ? 'Leads this benchmark' : 'Leads this setup'
}

// Best-score mode: one cell per benchmark. A model with no result on
// any setup is the only case that gets "Run it", and it targets the
// benchmark's default setup (most models, ties -> most recent) --
// `column.setups` is never empty (see buildLeaderboard.ts).
export function bestCellContent(column: BenchmarkColumn, checkpointId: number): ScoreCellContent {
  const best = column.bestResultsByCheckpointId[checkpointId]
  return {
    result: best ? { setup: best.setup, cell: best.cell } : null,
    otherSetups: best ? best.otherSetups : [],
    rankScope: 'benchmark',
    runItStandardId: column.setups[0].standardId,
  }
}

// All-setups mode: one cell per setup sub-column.
export function setupCellContent(setup: SetupOption, checkpointId: number): ScoreCellContent {
  const cell = setup.cellsByCheckpointId[checkpointId]
  return {
    result: cell ? { setup, cell } : null,
    otherSetups: [],
    rankScope: 'setup',
    runItStandardId: setup.standardId,
  }
}

// Written out in full (not built from a template string) so Tailwind's
// build-time scanner actually generates these utilities -- see the
// same note on StyleguidePage.tsx's own swatch classes. Low alpha: the
// tint is a hint, not a replacement for the score text's own contrast.
export const HEAT_BACKGROUND_CLASSES: Record<number, string> = {
  1: 'bg-heat-1/10',
  2: 'bg-heat-2/10',
  3: 'bg-heat-3/15',
  4: 'bg-heat-4/15',
  5: 'bg-heat-5/20',
}
