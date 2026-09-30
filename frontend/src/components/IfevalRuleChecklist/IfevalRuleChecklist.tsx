import type { RuleCheck } from '../../api/client'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { hasKnownOutcome, ruleOutcomeClassName, ruleOutcomeText } from './IfevalRuleChecklist.helper'

interface IfevalRuleChecklistProps {
  rules: RuleCheck[]
}

// The per-rule tick list -- the one IFEval/IFBench-specific renderer
// in the catalog. Strict and loose side by side per rule --
// distinguishes "the model broke the rule" from "the model wrapped a
// correct answer badly."
//
// Labelled as recomputed diagnostic detail, next to SampleDetail's own
// display of the harness's authoritative scores above it: this table
// is expected to disagree with the stored score on a couple of
// instructions per real IFEval run (the two random-letter samples) and
// that gap is never reconciled -- the caption says so rather than
// presenting the recheck as if it were the score of record.
export function IfevalRuleChecklist({ rules }: IfevalRuleChecklistProps) {
  if (rules.length === 0) {
    return null
  }

  const showsOutcomes = hasKnownOutcome(rules)

  return (
    <section className="mt-4">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Rules</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Recomputed diagnostic detail — may disagree with the stored score by an instruction or
        two. The score above stays authoritative.
      </p>
      {!showsOutcomes && (
        <p className="mt-1 text-xs text-warning">
          The per-rule recheck hasn't produced an outcome for this sample — showing the rules
          without ticks.
        </p>
      )}
      <div className="mt-2">
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>Rule</TableHeaderCell>
              <TableHeaderCell className="text-right">Strict</TableHeaderCell>
              <TableHeaderCell className="text-right">Loose</TableHeaderCell>
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
                <TableCell>
                  {rule.description}
                  <span className="ml-2 font-mono text-xs text-subtle-foreground">{rule.rule_id}</span>
                </TableCell>
                <TableCell className={`text-right font-mono ${ruleOutcomeClassName(rule.strict)}`}>
                  {ruleOutcomeText(rule.strict)}
                </TableCell>
                <TableCell className={`text-right font-mono ${ruleOutcomeClassName(rule.loose)}`}>
                  {ruleOutcomeText(rule.loose)}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  )
}
