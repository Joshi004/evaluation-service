import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { Checkpoint, EvalRun, LineageEdge, LineageNodePosition } from '../../data/types'
import { formatHalfWidth, formatValue, type MetricUnit } from '../ConfidenceInterval/ConfidenceInterval.helper'

export interface LineageNodeData extends Record<string, unknown> {
  name: string
  isPublished: boolean
  isFocused: boolean
  /** Selected as one of the (up to two) checkpoints for a merge — Model History page only. */
  isSelected: boolean
  /** This checkpoint's branch was abandoned — see data/lineage.ts edge details. Model History page only. */
  isDeadEnd: boolean
  /** A root checkpoint whose own parent isn't tracked in the registry. Model History page only. */
  isOrphanRoot: boolean
  scoreLabel: string
}

// Grouped into one options object, rather than three more positional
// `readonly string[]` params, so a caller can't accidentally swap which
// id set means what — Model History page only, Checkpoint Detail passes
// none of these.
export interface LineageNodeHighlights {
  selectedCheckpointIds?: readonly string[]
  deadEndCheckpointIds?: readonly string[]
  orphanRootCheckpointIds?: readonly string[]
}

function formatScoreLabel(value: number, stderr: number, unit: MetricUnit): string {
  return `${formatValue(value, unit)} ± ${formatHalfWidth(stderr, unit)}`
}

// A node's label re-computes per selected benchmark — the same lineage
// graph reads differently for IFEval than for GSM8K, which is the point
// (EVAL_SERVICE_PLAN.md Section 14: "you can see the RL stage helped
// IFEval and hurt GSM8K at a glance"). Only standard, published runs
// count — this graph is telling the leaderboard's story, not a raw log
// of every experiment.
export function buildFlowNodes(
  checkpoints: readonly Checkpoint[],
  positions: readonly LineageNodePosition[],
  runs: readonly EvalRun[],
  benchmarkId: string,
  primaryMetricKey: string,
  unit: MetricUnit,
  focusedCheckpointId: string,
  highlights: LineageNodeHighlights = {},
): Node<LineageNodeData>[] {
  const selectedIds = new Set(highlights.selectedCheckpointIds ?? [])
  const deadEndIds = new Set(highlights.deadEndCheckpointIds ?? [])
  const orphanRootIds = new Set(highlights.orphanRootCheckpointIds ?? [])

  return checkpoints.map((checkpoint) => {
    const position = positions.find((p) => p.checkpointId === checkpoint.id) ?? { x: 0, y: 0 }
    const run = runs.find(
      (candidate) =>
        candidate.checkpointId === checkpoint.id &&
        candidate.benchmarkId === benchmarkId &&
        candidate.isStandard &&
        candidate.published,
    )
    const result = run?.metrics.find((metric) => metric.metricKey === primaryMetricKey)

    return {
      id: checkpoint.id,
      type: 'lineage',
      position: { x: position.x, y: position.y },
      data: {
        name: checkpoint.name,
        isPublished: checkpoint.published,
        isFocused: checkpoint.id === focusedCheckpointId,
        isSelected: selectedIds.has(checkpoint.id),
        isDeadEnd: deadEndIds.has(checkpoint.id),
        isOrphanRoot: orphanRootIds.has(checkpoint.id),
        scoreLabel: result ? formatScoreLabel(result.value, result.stderr, unit) : 'no data',
      },
      draggable: false,
    }
  })
}

// xyflow's Edge<T> requires T to satisfy Record<string, unknown>, which the
// plain LineageEdge domain interface doesn't (same reason LineageNodeData
// above is its own type rather than Checkpoint itself) — so the source
// edge is wrapped rather than handed to Edge<T> directly.
export interface LineageEdgeData extends Record<string, unknown> {
  edge: LineageEdge
}

// Carries the source LineageEdge through as each flow edge's `data`, so a
// click handler can hand the caller the real edge object instead of
// re-parsing it back out of the generated id string.
export function buildFlowEdges(edges: readonly LineageEdge[]): Edge<LineageEdgeData>[] {
  return edges.map((edge) => ({
    id: `${edge.fromCheckpointId}->${edge.toCheckpointId}`,
    source: edge.fromCheckpointId,
    target: edge.toCheckpointId,
    label: edge.operation,
    labelStyle: { fill: '#94a3b8', fontSize: 11 },
    labelBgStyle: { fill: '#020617' },
    style: { stroke: '#475569' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
    data: { edge },
  }))
}
