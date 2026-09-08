import type { Checkpoint } from './types'

// 10 checkpoints across 3 lineage families, mirroring the exact example
// graph in EVAL_SERVICE_PLAN.md Section 14 for the Qwen3-4B family (base ->
// two SFT branches -> two RL branches -> the published ternary-quantized
// checkpoint that Milestone 1 targets), plus one medical and one vision
// family so Compare and the leaderboard have cross-team variety.
export const checkpoints: Checkpoint[] = [
  {
    id: 'qwen3-4b-base',
    name: 'Qwen3-4B (base)',
    team: 'tool-call',
    modality: 'text',
    sizeParams: '4B',
    quantization: null,
    parentId: null,
    lineageOp: null,
    lineageDetail: null,
    storage: 'nfs',
    staged: true,
    published: false,
    registeredBy: 'j.tanaka',
    createdAt: '2026-04-02',
    trainingRunUrl: null,
    notes: 'Upstream Qwen3-4B base checkpoint. Not evaluated under our standards directly — every branch below is.',
    mergedFromIds: null,
  },
  {
    id: 'qwen3-4b-sft-v1',
    name: 'Qwen3-4B-sft-v1',
    team: 'tool-call',
    modality: 'text',
    sizeParams: '4B',
    quantization: null,
    parentId: 'qwen3-4b-base',
    lineageOp: 'SFT',
    lineageDetail: '40k tool traces',
    storage: 'nfs',
    staged: true,
    published: false,
    registeredBy: 'j.tanaka',
    createdAt: '2026-04-18',
    trainingRunUrl: 'https://wandb.ai/tether/qwen3-4b-tool-call/runs/sft-v1',
    notes: 'First SFT pass, agentic tool-call traces only.',
    mergedFromIds: null,
  },
  {
    id: 'qwen3-4b-sft-v2',
    name: 'Qwen3-4B-sft-v2',
    team: 'tool-call',
    modality: 'text',
    sizeParams: '4B',
    quantization: null,
    parentId: 'qwen3-4b-base',
    lineageOp: 'SFT',
    lineageDetail: '+12k rewrites',
    storage: 'nfs',
    staged: true,
    published: false,
    registeredBy: 'j.tanaka',
    createdAt: '2026-05-06',
    trainingRunUrl: 'https://wandb.ai/tether/qwen3-4b-tool-call/runs/sft-v2',
    notes: 'Second SFT branch off the same base, with 12k additional rewritten traces.',
    mergedFromIds: null,
  },
  {
    id: 'qwen3-4b-rl-step400',
    name: 'Qwen3-4B-rl-step400',
    team: 'tool-call',
    modality: 'text',
    sizeParams: '4B',
    quantization: null,
    parentId: 'qwen3-4b-sft-v2',
    lineageOp: 'RL',
    lineageDetail: '400 steps',
    storage: 'nfs',
    staged: true,
    published: false,
    registeredBy: 'a.oyelaran',
    createdAt: '2026-06-01',
    trainingRunUrl: 'https://wandb.ai/tether/qwen3-4b-tool-call/runs/rl-step400',
    notes: 'RL off sft-v2. Best IFEval/GSM8K balance of the two RL branches — this is what got quantized.',
    mergedFromIds: null,
  },
  {
    id: 'qwen3-4b-rl-step600',
    name: 'Qwen3-4B-rl-step600',
    team: 'tool-call',
    modality: 'text',
    sizeParams: '4B',
    quantization: null,
    parentId: 'qwen3-4b-sft-v2',
    lineageOp: 'RL',
    lineageDetail: '600 steps',
    storage: 'nfs',
    staged: true,
    published: false,
    registeredBy: 'a.oyelaran',
    createdAt: '2026-06-09',
    trainingRunUrl: 'https://wandb.ai/tether/qwen3-4b-tool-call/runs/rl-step600',
    notes: 'Abandoned branch — 200 more RL steps than step400 cost GSM8K without an IFEval gain to justify it. Kept visible on the lineage graph deliberately.',
    mergedFromIds: null,
  },
  {
    id: 'qwen3-4b-allternary-ep03',
    name: 'Qwen3-4B-allternary-ep03',
    team: 'one-bit-models',
    modality: 'text',
    sizeParams: '4B',
    quantization: 'ternary',
    parentId: 'qwen3-4b-rl-step400',
    lineageOp: 'Quantization',
    lineageDetail: 'ternary quantization, epoch 3',
    storage: 'nfs',
    staged: true,
    published: true,
    registeredBy: 'svc-import',
    createdAt: '2026-08-22',
    trainingRunUrl: 'https://wandb.ai/tether/one-bit-models/runs/allternary-ep03',
    notes:
      'The Milestone 1 checkpoint. Already on the shared NFS at /home/shared/agentic_slm/models/Qwen3-4B-allternary-ep03 — no S3 staging needed. A thinking model: see its IFEval runs for why think_handling and max_tokens matter here.',
    mergedFromIds: null,
  },
  {
    id: 'medpsy-7b-sft-v1',
    name: 'MedPsy-7B-sft-v1',
    team: 'medpsy',
    modality: 'medical',
    sizeParams: '7B',
    quantization: null,
    parentId: null,
    lineageOp: null,
    lineageDetail: null,
    storage: 's3',
    staged: false,
    published: false,
    registeredBy: 'm.silva',
    createdAt: '2026-05-14',
    trainingRunUrl: 'https://wandb.ai/tether/medpsy/runs/sft-v1',
    notes: 'SFT from an external MedGemma-7B base (not tracked in our registry). Not yet staged on the cluster.',
    mergedFromIds: null,
  },
  {
    id: 'medpsy-7b-rl-v1',
    name: 'MedPsy-7B-rl-v1',
    team: 'medpsy',
    modality: 'medical',
    sizeParams: '7B',
    quantization: null,
    parentId: 'medpsy-7b-sft-v1',
    lineageOp: 'RL',
    lineageDetail: 'rubric-reward RL, 300 steps',
    storage: 's3',
    staged: true,
    published: true,
    registeredBy: 'm.silva',
    createdAt: '2026-07-02',
    trainingRunUrl: 'https://wandb.ai/tether/medpsy/runs/rl-v1',
    notes: 'Rubric-reward RL on top of sft-v1. Staged from S3 on first run; every run since has skipped staging.',
    mergedFromIds: null,
  },
  {
    id: 'visionpsy-nano-sft-v1',
    name: 'VisionPsy-Nano-sft-v1',
    team: 'vlm-eval',
    modality: 'vision',
    sizeParams: '2B',
    quantization: null,
    parentId: null,
    lineageOp: null,
    lineageDetail: null,
    storage: 's3',
    staged: false,
    published: false,
    registeredBy: 'p.dubois',
    createdAt: '2026-05-28',
    trainingRunUrl: 'https://wandb.ai/tether/visionpsy-nano/runs/sft-v1',
    notes: 'First SFT pass for the nano VLM. Not yet staged.',
    mergedFromIds: null,
  },
  {
    id: 'visionpsy-nano-distill-v2',
    name: 'VisionPsy-Nano-distill-v2',
    team: 'vlm-eval',
    modality: 'vision',
    sizeParams: '2B',
    quantization: null,
    parentId: 'visionpsy-nano-sft-v1',
    lineageOp: 'Distillation',
    lineageDetail: 'distilled from a Qwen2-VL-7B teacher',
    storage: 's3',
    staged: true,
    published: true,
    registeredBy: 'p.dubois',
    createdAt: '2026-07-20',
    trainingRunUrl: 'https://wandb.ai/tether/visionpsy-nano/runs/distill-v2',
    notes: 'Distilled from sft-v1 using a larger VLM teacher. Currently the only published VisionPsy-Nano checkpoint.',
    mergedFromIds: null,
  },
]

export function getCheckpoint(checkpointId: string): Checkpoint {
  const checkpoint = checkpoints.find((c) => c.id === checkpointId)
  if (!checkpoint) {
    throw new Error(`Unknown checkpoint id: ${checkpointId}`)
  }
  return checkpoint
}

// Non-throwing lookup against a *given* checkpoint list, rather than this
// module's fixture. Once a merge can add a checkpoint at runtime (see
// state/PrototypeStore.tsx), the checkpoint behind a run id might not be in
// this file at all, and the old throwing getCheckpoint() would crash — see
// state/useRunSimulation.ts, where that throw used to fire from inside a
// setInterval with no error boundary to catch it.
export function findCheckpoint(checkpoints: readonly Checkpoint[], checkpointId: string): Checkpoint | null {
  return checkpoints.find((c) => c.id === checkpointId) ?? null
}

export function getChildCheckpoints(checkpointId: string): Checkpoint[] {
  return checkpoints.filter((c) => c.parentId === checkpointId)
}

/**
 * All checkpoints in the same lineage tree as `checkpointId` (its root
 * ancestor's whole family), in registration order. Takes the checkpoint
 * list as a parameter rather than closing over this module's fixture, so
 * callers reading from the store (which can contain merged checkpoints
 * this file doesn't know about) get a correct family back.
 */
export function getLineageFamily(checkpoints: readonly Checkpoint[], checkpointId: string): Checkpoint[] {
  const byId = new Map(checkpoints.map((c) => [c.id, c] as const))

  function rootOf(id: string): string {
    const current = byId.get(id)
    if (!current || !current.parentId) return id
    return rootOf(current.parentId)
  }

  const rootId = rootOf(checkpointId)
  const family: Checkpoint[] = []
  const queue = [rootId]
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) continue
    const node = byId.get(id)
    if (!node) continue
    family.push(node)
    for (const child of checkpoints) {
      if (child.parentId === id) queue.push(child.id)
    }
  }
  return family
}
