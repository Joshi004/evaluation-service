// 95% CI half-width for a binomial proportion: 1.96 * sqrt(p(1-p)/n). This
// is the exact calculation behind the ±2.2 / ±4.0 / ±6.8 / ±18 point
// figures in EVAL_SERVICE_PLAN.md Section 5 for GSM8K / IFEval /
// GPQA-Diamond / AIME25 — verified against those four before reuse here.
export function standardErrorForProportion(p: number, sampleSize: number): number {
  return Math.sqrt((p * (1 - p)) / sampleSize)
}

export function confidenceIntervalHalfWidth(stderr: number): number {
  return 1.96 * stderr
}
