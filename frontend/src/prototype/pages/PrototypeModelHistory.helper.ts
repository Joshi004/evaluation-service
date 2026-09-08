import type { Benchmark, Checkpoint, EvalRun, LineageEdge, LineageNodePosition, Modality, Team } from '../data/types'
import { lineageNodePositions } from '../data/lineage'
import type { EdgeDiffBenchmarkRow } from '../components/EdgeDiffPanel/EdgeDiffPanel'
import { computeTwoWayDelta, deltaTone, deltaToneClass, formatDeltaMagnitude } from './PrototypeCompare.helper'
import { pickDisplayRun } from './PrototypeLeaderboard.helper'

export interface ModelHistoryFilters {
  team: Team | 'all'
  modality: Modality | 'all'
  publishedOnly: boolean
}

export function filterCheckpointsForHistory(checkpoints: readonly Checkpoint[], filters: ModelHistoryFilters): Checkpoint[] {
  return checkpoints.filter((checkpoint) => {
    if (filters.team !== 'all' && checkpoint.team !== filters.team) return false
    if (filters.modality !== 'all' && checkpoint.modality !== filters.modality) return false
    if (filters.publishedOnly && !checkpoint.published) return false
    return true
  })
}

// Vertical gap between the three lineage families on the combined canvas,
// keyed by each family's root checkpoint id. data/lineage.ts's positions
// deliberately reuse the same y per family (every root sits at y: 160)
// because Checkpoint Detail only ever draws one family at a time —
// stacking all three here needs an offset that only this page cares
// about, so it's kept out of that shared fixture rather than renumbering it.
const FAMILY_LANE_OFFSET_Y: Record<string, number> = {
  'qwen3-4b-base': 0,
  'medpsy-7b-sft-v1': 480,
  'visionpsy-nano-sft-v1': 700,
}

// The same 280px horizontal step data/lineage.ts already uses between
// every other generation, so a merge product reads as "one more step
// right" instead of visually different from the rest of the graph.
const MERGED_NODE_X_GAP = 280

// Walks a checkpoint's parentId chain back to its root. A near-duplicate
// of the private rootOf() inside getLineageFamily() (data/checkpoints.ts)
// rather than a shared export from there — this page is the only caller
// that needs "which root's lane offset applies here", not a whole family.
function familyRootId(checkpoint: Checkpoint, checkpoints: readonly Checkpoint[]): string {
  let current = checkpoint
  while (current.parentId) {
    const parent = checkpoints.find((candidate) => candidate.id === current.parentId)
    if (!parent) break
    current = parent
  }
  return current.id
}

/**
 * One node position per checkpoint for the combined, three-family canvas.
 * A fixture checkpoint keeps its hand-placed x from data/lineage.ts with
 * its family's lane offset added to y. A merged checkpoint has no fixture
 * position at all, so it's placed to the right of its rightmost parent —
 * both parents are guaranteed to already have a position here, since a
 * checkpoint can only be merged after it exists (merges only ever append
 * to the store's checkpoint list, see state/PrototypeStore.tsx).
 */
export function buildHistoryLayout(checkpoints: readonly Checkpoint[], edges: readonly LineageEdge[]): LineageNodePosition[] {
  const positionById = new Map<string, { x: number; y: number }>()

  for (const checkpoint of checkpoints) {
    const fixedPosition = lineageNodePositions.find((position) => position.checkpointId === checkpoint.id)
    if (fixedPosition) {
      const laneOffsetY = FAMILY_LANE_OFFSET_Y[familyRootId(checkpoint, checkpoints)] ?? 0
      positionById.set(checkpoint.id, { x: fixedPosition.x, y: fixedPosition.y + laneOffsetY })
      continue
    }

    const parentPositions = edges
      .filter((edge) => edge.toCheckpointId === checkpoint.id)
      .map((edge) => positionById.get(edge.fromCheckpointId))
      .filter((position): position is { x: number; y: number } => position !== undefined)

    positionById.set(
      checkpoint.id,
      parentPositions.length > 0
        ? {
            x: Math.max(...parentPositions.map((position) => position.x)) + MERGED_NODE_X_GAP,
            y: parentPositions.reduce((sum, position) => sum + position.y, 0) / parentPositions.length,
          }
        : { x: 0, y: 0 },
    )
  }

  return checkpoints.map((checkpoint) => ({
    checkpointId: checkpoint.id,
    ...(positionById.get(checkpoint.id) ?? { x: 0, y: 0 }),
  }))
}

/**
 * An edge whose own detail documents the branch as abandoned — see
 * qwen3-4b-rl-step600's edge in data/lineage.ts. Reads the narrative
 * `detail` text rather than hardcoding an id, so any future fixture that
 * documents the same thing is picked up automatically.
 */
function isAbandonedEdge(edge: LineageEdge): boolean {
  return edge.detail.toLowerCase().includes('abandoned')
}

export function getDeadEndCheckpointIds(edges: readonly LineageEdge[]): string[] {
  return edges.filter(isAbandonedEdge).map((edge) => edge.toCheckpointId)
}

/**
 * A root checkpoint (no parentId) whose own note says its upstream base
 * isn't tracked here — see medpsy-7b-sft-v1's note in data/checkpoints.ts.
 * Same reasoning as isAbandonedEdge above: read the narrative field
 * instead of hardcoding which id counts, so this stays honest about why
 * a node is flagged rather than being a magic id list.
 */
function isOrphanRoot(checkpoint: Checkpoint): boolean {
  return checkpoint.parentId === null && checkpoint.notes.toLowerCase().includes('registry')
}

export function getOrphanRootCheckpointIds(checkpoints: readonly Checkpoint[]): string[] {
  return checkpoints.filter(isOrphanRoot).map((checkpoint) => checkpoint.id)
}

/** Benchmarks with at least one run among the given checkpoints — the same "don't offer an always-empty option" rule Checkpoint Detail's own lineage selector uses. */
export function getBenchmarksWithData(
  checkpointIds: readonly string[],
  benchmarks: readonly Benchmark[],
  runs: readonly EvalRun[],
): Benchmark[] {
  const idSet = new Set(checkpointIds)
  const benchmarkIdsWithData = new Set(runs.filter((run) => idSet.has(run.checkpointId)).map((run) => run.benchmarkId))
  return benchmarks.filter((benchmark) => benchmarkIdsWithData.has(benchmark.id))
}

/**
 * One row per benchmark where both ends of this edge have a standard,
 * published result — built from computeTwoWayDelta/deltaTone/deltaToneClass
 * (PrototypeCompare.helper.ts) so this graph's edge diff can never disagree
 * with what the Compare page would show for the same two checkpoints.
 */
export function buildEdgeDiffRows(edge: LineageEdge, benchmarks: readonly Benchmark[], runs: readonly EvalRun[]): EdgeDiffBenchmarkRow[] {
  const rows: EdgeDiffBenchmarkRow[] = []

  for (const benchmark of benchmarks) {
    const runFrom = pickDisplayRun(edge.fromCheckpointId, benchmark.id, runs, true)
    const runTo = pickDisplayRun(edge.toCheckpointId, benchmark.id, runs, true)
    if (!runFrom || !runTo) continue

    const delta = computeTwoWayDelta(benchmark, runFrom, runTo)
    if (!delta) continue

    const primaryMetricDef = benchmark.metrics.find((metric) => metric.key === benchmark.primaryMetricKey)
    const tone = deltaTone(delta, primaryMetricDef?.higherIsBetter ?? true)

    rows.push({
      benchmarkId: benchmark.id,
      benchmarkName: benchmark.name,
      deltaLabel: formatDeltaMagnitude(delta),
      toneClass: deltaToneClass(tone),
      noiseLabel: delta.isOutsideNoise ? '(likely real)' : '(within noise)',
    })
  }

  return rows
}
