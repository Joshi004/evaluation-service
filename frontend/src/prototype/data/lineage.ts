import type { LineageEdge, LineageNodePosition } from './types'
import { getCheckpoint } from './checkpoints'

// Fixed node positions for a left-to-right lineage layout, one entry per
// checkpoint. Hand-placed rather than run through a graph-layout library
// (dagre/ELK) — the plan calls for a fixed demo graph, and these are the
// only 10 nodes it will ever need to draw.
export const lineageNodePositions: LineageNodePosition[] = [
  { checkpointId: 'qwen3-4b-base', x: 0, y: 160 },
  { checkpointId: 'qwen3-4b-sft-v1', x: 280, y: 40 },
  { checkpointId: 'qwen3-4b-sft-v2', x: 280, y: 280 },
  { checkpointId: 'qwen3-4b-rl-step400', x: 560, y: 200 },
  { checkpointId: 'qwen3-4b-rl-step600', x: 560, y: 360 },
  { checkpointId: 'qwen3-4b-allternary-ep03', x: 840, y: 200 },

  { checkpointId: 'medpsy-7b-sft-v1', x: 0, y: 160 },
  { checkpointId: 'medpsy-7b-rl-v1', x: 280, y: 160 },

  { checkpointId: 'visionpsy-nano-sft-v1', x: 0, y: 160 },
  { checkpointId: 'visionpsy-nano-distill-v2', x: 280, y: 160 },
]

// Every edge is derived from a checkpoint's own parentId/lineageOp — this
// array just carries the extra display detail (the annotation you'd click
// an edge to see) that doesn't belong on the Checkpoint type itself.
export const lineageEdges: LineageEdge[] = [
  {
    fromCheckpointId: 'qwen3-4b-base',
    toCheckpointId: 'qwen3-4b-sft-v1',
    operation: 'SFT',
    detail: '40k tool traces',
    trainingRunUrl: 'https://wandb.ai/tether/qwen3-4b-tool-call/runs/sft-v1',
  },
  {
    fromCheckpointId: 'qwen3-4b-base',
    toCheckpointId: 'qwen3-4b-sft-v2',
    operation: 'SFT',
    detail: '+12k rewrites',
    trainingRunUrl: 'https://wandb.ai/tether/qwen3-4b-tool-call/runs/sft-v2',
  },
  {
    fromCheckpointId: 'qwen3-4b-sft-v2',
    toCheckpointId: 'qwen3-4b-rl-step400',
    operation: 'RL',
    detail: '400 steps',
    trainingRunUrl: 'https://wandb.ai/tether/qwen3-4b-tool-call/runs/rl-step400',
  },
  {
    fromCheckpointId: 'qwen3-4b-sft-v2',
    toCheckpointId: 'qwen3-4b-rl-step600',
    operation: 'RL',
    detail: '600 steps — abandoned, no IFEval gain over step400 and GSM8K got worse',
    trainingRunUrl: 'https://wandb.ai/tether/qwen3-4b-tool-call/runs/rl-step600',
  },
  {
    fromCheckpointId: 'qwen3-4b-rl-step400',
    toCheckpointId: 'qwen3-4b-allternary-ep03',
    operation: 'Quantization',
    detail: 'ternary quantization, epoch 3',
    trainingRunUrl: 'https://wandb.ai/tether/one-bit-models/runs/allternary-ep03',
  },
  {
    fromCheckpointId: 'medpsy-7b-sft-v1',
    toCheckpointId: 'medpsy-7b-rl-v1',
    operation: 'RL',
    detail: 'rubric-reward RL, 300 steps',
    trainingRunUrl: 'https://wandb.ai/tether/medpsy/runs/rl-v1',
  },
  {
    fromCheckpointId: 'visionpsy-nano-sft-v1',
    toCheckpointId: 'visionpsy-nano-distill-v2',
    operation: 'Distillation',
    detail: 'distilled from a Qwen2-VL-7B teacher',
    trainingRunUrl: 'https://wandb.ai/tether/visionpsy-nano/runs/distill-v2',
  },
]

export function getNodePosition(checkpointId: string): LineageNodePosition {
  const position = lineageNodePositions.find((p) => p.checkpointId === checkpointId)
  if (!position) {
    throw new Error(`No lineage position for checkpoint id: ${checkpointId}`)
  }
  return position
}

/**
 * Edges where both endpoints are in the given checkpoint id set. Takes the
 * edge list as a parameter rather than closing over this module's fixture,
 * so a caller reading from the store (which can contain merge-created
 * edges this file doesn't know about) gets a correct result.
 */
export function getEdgesWithin(edges: readonly LineageEdge[], checkpointIds: readonly string[]): LineageEdge[] {
  const idSet = new Set(checkpointIds)
  return edges.filter((edge) => idSet.has(edge.fromCheckpointId) && idSet.has(edge.toCheckpointId))
}

/** True if this checkpoint is a published, released model. */
export function isPublishedCheckpoint(checkpointId: string): boolean {
  return getCheckpoint(checkpointId).published
}
