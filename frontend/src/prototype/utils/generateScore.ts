import type { Benchmark } from '../data/types'

// A short, stable hash of a string into [0, 1). Not cryptographic — this
// only needs to be deterministic, so that submitting the same (checkpoint,
// benchmark) pair twice in one demo always lands on the same fabricated
// number instead of jittering on every click.
function hashStringToUnitInterval(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash / 0xffffffff
}

// Fabricates a plausible score for a (checkpoint, benchmark) pair that has
// no hand-authored result in data/runs.ts — i.e. any combination a user
// picks freely on the Submit page. Deterministic per pair, within the
// benchmark's own plausibleScoreRange.
export function generatePlausibleScore(checkpointId: string, benchmark: Benchmark): number {
  const [min, max] = benchmark.plausibleScoreRange
  const unit = hashStringToUnitInterval(`${checkpointId}:${benchmark.id}`)
  return min + unit * (max - min)
}
