// Reshapes a LeaderboardBoard (buildLeaderboard.ts) around one model --
// ranks are Leaderboard ranks, by construction. The Model page never
// re-derives a rank or a leader flag -- it reads the same board the
// Leaderboard itself renders, so the two can never disagree about who
// is ahead on a given setup.
import type { StandardSummary } from '../api/client'
import { benchmarkDisplayName } from './benchmarkDisplayName'
import type { LeaderboardBoard, ScoreCellData, SetupOption } from './buildLeaderboard'

export interface ModelEvaluatedResult {
  benchmark: string
  benchmarkDisplayName: string
  setup: SetupOption
  cell: ScoreCellData
}

export interface ModelNotEvaluatedResult {
  benchmark: string
  benchmarkDisplayName: string
  // The benchmark's newest standard -- what "Run it" and "Evaluate on
  // missing benchmarks" target, so a benchmark with several published
  // versions always evaluates against the current one.
  standardId: number
}

export interface ModelResults {
  evaluated: ModelEvaluatedResult[]
  notEvaluated: ModelNotEvaluatedResult[]
}

function compareEvaluatedResults(a: ModelEvaluatedResult, b: ModelEvaluatedResult): number {
  if (a.benchmarkDisplayName !== b.benchmarkDisplayName) {
    return a.benchmarkDisplayName.localeCompare(b.benchmarkDisplayName)
  }
  return b.setup.modelCount - a.setup.modelCount
}

function newestStandardByBenchmark(standards: StandardSummary[]): Map<string, StandardSummary> {
  const newestByBenchmark = new Map<string, StandardSummary>()
  for (const standard of standards) {
    const current = newestByBenchmark.get(standard.benchmark)
    if (!current || new Date(standard.created_at) > new Date(current.created_at)) {
      newestByBenchmark.set(standard.benchmark, standard)
    }
  }
  return newestByBenchmark
}

// One evaluated card per (benchmark, setup) this model has a done
// result on, plus one "not evaluated" card per catalog benchmark with
// no done result at all -- a model with a result on one setup of a
// benchmark but not another is "evaluated" for that benchmark (the
// scorecard already shows it), so only a benchmark absent from every
// setup counts as missing.
export function buildModelResults(
  board: LeaderboardBoard,
  standards: StandardSummary[],
  checkpointId: number,
): ModelResults {
  const evaluated: ModelEvaluatedResult[] = []
  const evaluatedBenchmarks = new Set<string>()

  for (const column of board.columns) {
    for (const setup of column.setups) {
      const cell = setup.cellsByCheckpointId[checkpointId]
      if (cell) {
        evaluated.push({ benchmark: column.benchmark, benchmarkDisplayName: column.displayName, setup, cell })
        evaluatedBenchmarks.add(column.benchmark)
      }
    }
  }
  evaluated.sort(compareEvaluatedResults)

  const notEvaluated = [...newestStandardByBenchmark(standards).values()]
    .filter((standard) => !evaluatedBenchmarks.has(standard.benchmark))
    .map((standard) => ({
      benchmark: standard.benchmark,
      benchmarkDisplayName: benchmarkDisplayName(standard.benchmark, standards),
      standardId: standard.id,
    }))
    .sort((a, b) => a.benchmarkDisplayName.localeCompare(b.benchmarkDisplayName))

  return { evaluated, notEvaluated }
}

export interface SharedSetupComparison {
  benchmark: string
  benchmarkDisplayName: string
  setup: SetupOption
  baselineCell: ScoreCellData
  otherCell: ScoreCellData
}

// Every (benchmark, setup) both models have a done result on -- the
// Lineage tab's own parent/child delta table (baseline = parent, other
// = child) and the "Compare with..." dialog (baseline = the model
// whose page this is, other = whichever model was picked) both read
// this the same way: the setups a comparison can actually show,
// nothing else.
export function findSharedSetups(
  board: LeaderboardBoard,
  baselineCheckpointId: number,
  otherCheckpointId: number,
): SharedSetupComparison[] {
  const shared: SharedSetupComparison[] = []
  for (const column of board.columns) {
    for (const setup of column.setups) {
      const baselineCell = setup.cellsByCheckpointId[baselineCheckpointId]
      const otherCell = setup.cellsByCheckpointId[otherCheckpointId]
      if (baselineCell && otherCell) {
        shared.push({
          benchmark: column.benchmark,
          benchmarkDisplayName: column.displayName,
          setup,
          baselineCell,
          otherCell,
        })
      }
    }
  }
  return shared.sort((a, b) => a.benchmarkDisplayName.localeCompare(b.benchmarkDisplayName))
}
