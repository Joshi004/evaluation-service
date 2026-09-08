import { Background, Controls, Handle, Position, ReactFlow, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Checkpoint, EvalRun, LineageEdge, LineageNodePosition } from '../../data/types'
import type { MetricUnit } from '../ConfidenceInterval/ConfidenceInterval.helper'
import { buildFlowEdges, buildFlowNodes, type LineageNodeData } from './LineageGraph.helper'

type LineageFlowNode = Node<LineageNodeData>

function LineageNodeRenderer({ data }: NodeProps<LineageFlowNode>) {
  const borderClass = data.isFocused
    ? 'border-sky-400 bg-sky-500/10'
    : data.isDeadEnd
      ? 'border-dashed border-amber-500/50 bg-slate-900'
      : 'border-slate-700 bg-slate-900'
  const selectionRingClass = data.isSelected ? 'ring-2 ring-violet-400' : ''

  return (
    <div className={`cursor-pointer rounded-lg border px-3 py-2 text-xs shadow-sm ${borderClass} ${selectionRingClass}`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-600" />
      <p className="font-medium text-slate-100">{data.name}</p>
      <p className="mt-1 text-slate-400">{data.scoreLabel}</p>
      {(data.isPublished || data.isDeadEnd || data.isOrphanRoot) && (
        <div className="mt-1 flex flex-wrap gap-x-2">
          {data.isPublished && <span className="text-[10px] font-medium text-emerald-400">Published</span>}
          {data.isDeadEnd && <span className="text-[10px] font-medium text-amber-400">Abandoned</span>}
          {data.isOrphanRoot && <span className="text-[10px] font-medium text-amber-400">Untracked base</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-slate-600" />
    </div>
  )
}

const nodeTypes = { lineage: LineageNodeRenderer }

interface LineageGraphProps {
  checkpoints: Checkpoint[]
  positions: LineageNodePosition[]
  edges: LineageEdge[]
  runs: EvalRun[]
  benchmarkId: string
  primaryMetricKey: string
  unit: MetricUnit
  focusedCheckpointId: string
  /** Canvas height in pixels. Defaults to the compact size Checkpoint Detail has always used — the Model History page's combined 3-family canvas passes a taller value. */
  height?: number
  /** Checkpoint ids selected for a merge — Model History page only. */
  selectedCheckpointIds?: readonly string[]
  /** Checkpoint ids on an abandoned branch — Model History page only. */
  deadEndCheckpointIds?: readonly string[]
  /** Root checkpoint ids whose own parent isn't tracked — Model History page only. */
  orphanRootCheckpointIds?: readonly string[]
  /** Omit to keep nodes non-interactive, exactly like Checkpoint Detail's read-only view. */
  onNodeClick?: (checkpointId: string) => void
  /** Omit to keep edges non-interactive, exactly like Checkpoint Detail's read-only view. */
  onEdgeClick?: (edge: LineageEdge) => void
}

// A checkpoint's history is a graph, not a list (EVAL_SERVICE_PLAN.md
// Section 14) — nodes are checkpoints labelled with the selected
// benchmark's score, edges are annotated operations. Positions are fixed
// in data/lineage.ts rather than laid out by dagre/ELK, since this is a
// small, hand-arranged demo graph, not an arbitrary one. Shared by
// Checkpoint Detail (one family, read-only) and the Model History page
// (all families, clickable nodes/edges, merge selection) — the click and
// highlight props are all optional so Checkpoint Detail's usage is unaffected.
export function LineageGraph({
  checkpoints,
  positions,
  edges,
  runs,
  benchmarkId,
  primaryMetricKey,
  unit,
  focusedCheckpointId,
  height = 360,
  selectedCheckpointIds,
  deadEndCheckpointIds,
  orphanRootCheckpointIds,
  onNodeClick,
  onEdgeClick,
}: LineageGraphProps) {
  const nodes = buildFlowNodes(checkpoints, positions, runs, benchmarkId, primaryMetricKey, unit, focusedCheckpointId, {
    selectedCheckpointIds,
    deadEndCheckpointIds,
    orphanRootCheckpointIds,
  })
  const flowEdges = buildFlowEdges(edges)

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        onNodeClick={onNodeClick ? (_event, node) => onNodeClick(node.id) : undefined}
        onEdgeClick={
          onEdgeClick
            ? (_event, edge) => {
                if (edge.data) onEdgeClick(edge.data.edge)
              }
            : undefined
        }
      >
        <Background color="#1e293b" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
