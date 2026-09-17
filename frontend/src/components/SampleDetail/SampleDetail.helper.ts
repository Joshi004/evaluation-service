// Non-DOM logic for SampleDetail.tsx: formatting the answer's
// metadata line and the harness's own scores, plus the one decision
// that picks which "bottom" section a sample gets. Kept out of the
// component body per .cursor/rules/frontend-components.mdc.

import type { DiagnosticsSampleDetail } from '../../api/client'

// "3,146 output tokens · 22.7s · stopped: stop" -- docs/SCORE_DRILLDOWN_UI_PLAN.md
// Section 4, Layer 5's own mock. Omits whichever piece is missing
// rather than a placeholder, the same convention
// RunHealthBand.helper.ts's cost/health lines use.
export function formatAnswerMeta(sample: DiagnosticsSampleDetail): string | null {
  const parts: string[] = []
  if (sample.tokens_out !== null) {
    parts.push(`${sample.tokens_out.toLocaleString()} output tokens`)
  }
  if (sample.latency_seconds !== null) {
    parts.push(`${sample.latency_seconds.toFixed(1)}s`)
  }
  if (sample.stop_reason !== null) {
    parts.push(`stopped: ${sample.stop_reason}`)
  }
  return parts.length > 0 ? parts.join(' \u00b7 ') : null
}

// The harness's own authoritative per-sample scores, e.g.
// "prompt_level_strict 0.00 · inst_level_strict 0.67" -- shown next to
// the (possibly recomputed) rule checklist so a reader can see which
// numbers stay authoritative (Phase 7: "Label the checklist as
// recomputed diagnostic detail, next to the harness's own
// authoritative scores").
export function formatScores(scores: Record<string, number>): string {
  return Object.entries(scores)
    .map(([name, value]) => `${name} ${value.toFixed(2)}`)
    .join(' \u00b7 ')
}

export function outcomeLabel(passed: boolean): string {
  return passed ? 'PASSED' : 'FAILED'
}

// The generic target/extracted-prediction block only makes sense when
// there's no rule checklist to show instead -- for IFEval/IFBench,
// target is always "" and extracted_prediction duplicates the answer
// verbatim, so showing it would just be noise (Phase 7: "Which
// renderer runs is decided by rules.length > 0, not by a benchmark
// name").
export function showsGenericComparison(sample: DiagnosticsSampleDetail): boolean {
  return sample.rules.length === 0
}
