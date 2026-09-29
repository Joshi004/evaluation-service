import { shortFingerprint } from './shortFingerprint'

// "IFEval · qwen3_5_think" -- a benchmark name plus its sampling
// profile, the same pairing a leaderboard column or a run's setup chip
// shows. `benchmarkName` is a display name the caller already resolved
// (e.g. via benchmarkDisplayName), not the raw slug, so this function
// stays a pure string join with no catalog lookup of its own. An
// unlabelled (ad-hoc) sampling profile has no name to show, so it falls
// back to its fingerprint: "IFEval · custom 77f35859".
export function setupLabel(
  benchmarkName: string,
  samplingProfileLabel: string | null,
  samplingProfileHash: string,
): string {
  const samplingPart = samplingProfileLabel ?? `custom ${shortFingerprint(samplingProfileHash)}`
  return `${benchmarkName} \u00b7 ${samplingPart}`
}
