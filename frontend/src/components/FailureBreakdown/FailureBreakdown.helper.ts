// Non-DOM logic for FailureBreakdown.tsx: grouping Layer 3's buckets by
// level, the labels and formatted text each row needs, and the
// micro/macro reconciliation note (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
// Phase 6). Kept out of the component body per
// .cursor/rules/frontend-components.mdc.

import type {
  DiagnosticsBucket,
  DiagnosticsInstructionLevel,
  DiagnosticsMetric,
} from '../../api/client'
import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'

// The only level whose rows are clickable -- IFEval/IFBench's family
// names (e.g. "length_constraints") never appear in a sample's own
// `instruction_id_list`, so the `rule` query parameter
// (backend/app/services/diagnostics/sample_query.py's `_carries_rule`)
// can only ever match a full rule id, never a family or subject name.
export const RULE_LEVEL = 'rule'

// Data, not branching -- this is what lets MMLU-Pro's "subject" level
// render with a real heading with no per-benchmark code here.
const LEVEL_LABELS: Record<string, string> = {
  family: 'By rule family',
  rule: 'By rule',
  subject: 'By subject',
}

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? level
}

// The rule table's collapsed height before "Show all N rules" is
// clicked -- the family table (9 rows on every benchmark in the
// catalog today) never grows large enough to need the same treatment.
export const COLLAPSED_RULE_ROWS = 10

export interface BucketGroup {
  level: string
  label: string
  buckets: DiagnosticsBucket[]
}

// Splits the flat `buckets` array into one group per level, preserving
// both the order levels first appear in (family before rule, per
// `benchmarks/ifeval.py`'s own concatenation) and each level's own
// internal order. The backend already sorted every level by
// instructions lost (`buckets.sort_buckets`), and that ordering is
// byte-stable across rebuilds -- this must never re-sort.
export function groupBucketsByLevel(buckets: DiagnosticsBucket[]): BucketGroup[] {
  const levelOrder: string[] = []
  const bucketsByLevel = new Map<string, DiagnosticsBucket[]>()

  for (const bucket of buckets) {
    let levelBuckets = bucketsByLevel.get(bucket.level)
    if (levelBuckets === undefined) {
      levelBuckets = []
      bucketsByLevel.set(bucket.level, levelBuckets)
      levelOrder.push(bucket.level)
    }
    levelBuckets.push(bucket)
  }

  return levelOrder.map((level) => ({
    level,
    label: levelLabel(level),
    buckets: bucketsByLevel.get(level) ?? [],
  }))
}

// "0 / 12", or "— / 12" when the recheck never ran for this run.
// `n_instructions` (how many instructions exist in the bucket) is
// always known; `passed` is null only when no known outcome exists for
// any of them (records.py's `Bucket` docstring).
export function bucketCountsText(bucket: DiagnosticsBucket): string {
  const passedText = bucket.passed === null ? '—' : String(bucket.passed)
  return `${passedText} / ${bucket.n_instructions}`
}

export function bucketPassRateText(bucket: DiagnosticsBucket): string {
  return formatFractionAsPercent(bucket.pass_rate)
}

// The inline proportion bar's fill width, 0-100. An unknown pass rate
// (a failed recheck) renders as an empty bar rather than a full one, so
// "no data" is never visually confused with "100%".
export function bucketProportionPercent(bucket: DiagnosticsBucket): number {
  return bucket.pass_rate === null ? 0 : bucket.pass_rate * 100
}

// True once every bucket in this run's build carries no known pass/fail
// outcome. A failed recheck leaves `rule_results` null on every sample
// uniformly, so this is never a mix in practice (buckets.py's own
// docstring) -- computed over the whole list rather than assumed.
export function hasNoKnownOutcome(buckets: DiagnosticsBucket[]): boolean {
  return buckets.length > 0 && buckets.every((bucket) => bucket.passed === null)
}

// The micro-vs-macro explanation (docs/SCORE_DRILLDOWN_UI_PLAN.md
// Section 4, "Layer 3": "if we show 89.8% underneath a headline of
// 91.0% with no explanation, someone will file a bug"). Returns []
// when this benchmark has no instruction-level metrics at all (GSM8K,
// GPQA-Diamond, MMLU-Pro) -- there is nothing to reconcile.
export function buildMicroMacroNote(
  instructionLevel: DiagnosticsInstructionLevel | null,
  metrics: DiagnosticsMetric[],
): string[] {
  if (instructionLevel === null) {
    return []
  }

  const macroDisplayName =
    metrics.find((metric) => metric.name === instructionLevel.macro_metric_name)?.display_name ??
    instructionLevel.macro_metric_name
  const microPercent = formatFractionAsPercent(instructionLevel.micro_value)
  const macroPercent = formatFractionAsPercent(instructionLevel.macro_value)

  const notes = [
    `This table pools all ${instructionLevel.micro_total} instructions (${microPercent}). ` +
      `The headline ${macroDisplayName} of ${macroPercent} averages per question, which weights ` +
      'a 1-rule question the same as a 3-rule one.',
  ]

  // The rows below come from Phase 5's recheck over the saved answers,
  // not from the stored harness scores `micro_passed` pools -- decision
  // 4 never reconciles the couple of samples where the two disagree
  // (751 vs 749 on run-13), so staying silent here would read as the
  // table being wrong rather than a documented, expected gap.
  if (
    instructionLevel.recheck_passed !== null &&
    instructionLevel.recheck_passed !== instructionLevel.micro_passed
  ) {
    notes.push(
      `The rows below sum to ${instructionLevel.recheck_passed} of ${instructionLevel.micro_total} ` +
        "— they are recomputed from the saved answers, and the harness's own score stays authoritative.",
    )
  }

  return notes
}
