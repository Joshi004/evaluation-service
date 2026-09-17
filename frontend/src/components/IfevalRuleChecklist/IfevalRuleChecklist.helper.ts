// Non-DOM logic for IfevalRuleChecklist.tsx: turning one rule's
// strict/loose outcome into display text and a colour. Kept out of
// the component body per .cursor/rules/frontend-components.mdc.

import type { RuleCheck } from '../../api/client'

// `null` means the recheck never ran for this sample (Phase 7: "When
// rule_results is null, show the scores and the rule list without
// ticks") -- an em dash reads as "unknown", not as a third outcome.
export function ruleOutcomeText(value: boolean | null): string {
  if (value === null) {
    return '\u2014'
  }
  return value ? 'pass' : 'FAIL'
}

export function ruleOutcomeClassName(value: boolean | null): string {
  if (value === null) {
    return 'text-slate-500'
  }
  return value ? 'text-emerald-400' : 'font-medium text-red-400'
}

// A sample's rule_results is either entirely known or entirely
// unknown -- store.py's own recheck fills every rule on a sample in
// one pass, never some of them (records.py's Bucket docstring makes
// the same "all-known or all-unknown in practice" observation at the
// bucket level). `.some` reads correctly either way: true the moment
// any rule carries a real outcome.
export function hasKnownOutcome(rules: RuleCheck[]): boolean {
  return rules.some((rule) => rule.strict !== null)
}
