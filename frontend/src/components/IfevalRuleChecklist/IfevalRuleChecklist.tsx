import type { RuleCheck } from '../../api/client'
import { hasKnownOutcome, ruleOutcomeClassName, ruleOutcomeText } from './IfevalRuleChecklist.helper'

interface IfevalRuleChecklistProps {
  rules: RuleCheck[]
}

// Layer 5's per-rule tick list (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
// Phase 7) -- the one IFEval/IFBench-specific renderer in the catalog.
// Strict and loose side by side per rule: "distinguishes 'the model
// broke the rule' from 'the model wrapped a correct answer badly'"
// (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4, Layer 5).
//
// Labelled as recomputed diagnostic detail, next to SampleDetail's own
// display of the harness's authoritative scores above it: this table
// is expected to disagree with the stored score on a couple of
// instructions per real IFEval run (the two random-letter samples,
// decision 4) and that gap is never reconciled -- the caption says so
// rather than presenting the recheck as if it were the score of
// record.
export function IfevalRuleChecklist({ rules }: IfevalRuleChecklistProps) {
  if (rules.length === 0) {
    return null
  }

  const showsOutcomes = hasKnownOutcome(rules)

  return (
    <section className="mt-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Rules</h2>
      <p className="mt-1 text-xs text-slate-500">
        Recomputed diagnostic detail — may disagree with the stored score by an instruction or
        two. The score above stays authoritative.
      </p>
      {!showsOutcomes && (
        <p className="mt-1 text-xs text-amber-400">
          The per-rule recheck hasn't produced an outcome for this sample — showing the rules
          without ticks.
        </p>
      )}
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
              Rule
            </th>
            <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
              Strict
            </th>
            <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
              Loose
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Keyed on rule_id plus position, not rule_id alone -- the
              same rule id can appear twice on one sample with
              different kwargs (run-13 key 1040's
              change_case:capital_word_frequency, once passing at
              "less than 10", once failing at "at least 1"). */}
          {rules.map((rule, index) => (
            <tr key={`${rule.rule_id}-${index}`}>
              <td className="border-b border-slate-800/50 p-2 text-slate-200">
                {rule.description}
                <span className="ml-2 font-mono text-xs text-slate-600">{rule.rule_id}</span>
              </td>
              <td
                className={`border-b border-slate-800/50 p-2 text-right font-mono ${ruleOutcomeClassName(rule.strict)}`}
              >
                {ruleOutcomeText(rule.strict)}
              </td>
              <td
                className={`border-b border-slate-800/50 p-2 text-right font-mono ${ruleOutcomeClassName(rule.loose)}`}
              >
                {ruleOutcomeText(rule.loose)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
