import { useState } from 'react'
import type { DiagnosticsBucket, DiagnosticsInstructionLevel, DiagnosticsMetric } from '../../api/client'
import { EmptyState } from '../EmptyState/EmptyState'
import {
  bucketCountsText,
  bucketPassRateText,
  bucketProportionPercent,
  buildMicroMacroNote,
  type BucketGroup,
  COLLAPSED_RULE_ROWS,
  groupBucketsByLevel,
  hasNoKnownOutcome,
  RULE_LEVEL,
} from './FailureBreakdown.helper'

interface FailureBreakdownProps {
  buckets: DiagnosticsBucket[]
  instructionLevel: DiagnosticsInstructionLevel | null
  metrics: DiagnosticsMetric[]
  activeRule: string | null
  onRuleChange: (rule: string | null) => void
}

// Layer 3 (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 6): the
// family and rule breakdown tables that sit above RunDiagnosticsPage's
// sample list. Plain sorted tables with the raw counts visible, not
// charts -- docs/SCORE_DRILLDOWN_UI_PLAN.md Section 9 says a 25-row bar
// chart is less readable than the list and hides the counts that make
// it checkable.
export function FailureBreakdown({
  buckets,
  instructionLevel,
  metrics,
  activeRule,
  onRuleChange,
}: FailureBreakdownProps) {
  // GSM8K and GPQA-Diamond have no natural grouping (Phase 5) and must
  // render this message instead of an empty table.
  if (buckets.length === 0) {
    return (
      <section className="mt-6">
        <EmptyState message="This benchmark has no failure breakdown — browse the samples below." />
      </section>
    )
  }

  const groups = groupBucketsByLevel(buckets)
  const noKnownOutcome = hasNoKnownOutcome(buckets)
  const microMacroNotes = buildMicroMacroNote(instructionLevel, metrics)

  return (
    <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-medium text-slate-200">Where the points went</h2>

      {/* A recheck that failed (or a benchmark it never ran for) still
          produces buckets from `instruction_id_list` alone -- Phase 6
          says show them with per-rule detail marked unavailable rather
          than an empty table. */}
      {noKnownOutcome && (
        <p className="mt-2 text-xs text-amber-400">
          Per-rule detail is unavailable for this run — the recheck did not produce an outcome.
          Showing which instructions exist in each bucket only.
        </p>
      )}

      {microMacroNotes.map((note) => (
        <p key={note} className="mt-2 text-xs text-slate-500">
          {note}
        </p>
      ))}

      {activeRule !== null && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-slate-400">
            Filtering samples to <span className="font-mono text-slate-200">{activeRule}</span>
          </span>
          <button type="button" onClick={() => onRuleChange(null)} className="text-blue-400 hover:underline">
            Clear rule filter
          </button>
        </div>
      )}

      {groups.map((group) => (
        <BucketTable key={group.level} group={group} activeRule={activeRule} onRuleChange={onRuleChange} />
      ))}
    </section>
  )
}

interface BucketTableProps {
  group: BucketGroup
  activeRule: string | null
  onRuleChange: (rule: string | null) => void
}

// Not exported -- one table per level, kept local because nothing
// outside this file ever renders a single level's rows on its own.
function BucketTable({ group, activeRule, onRuleChange }: BucketTableProps) {
  const [expanded, setExpanded] = useState(false)
  const isRuleLevel = group.level === RULE_LEVEL
  const collapsible = isRuleLevel && group.buckets.length > COLLAPSED_RULE_ROWS
  const visibleBuckets =
    collapsible && !expanded ? group.buckets.slice(0, COLLAPSED_RULE_ROWS) : group.buckets

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-slate-300">{group.label}</h3>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">Name</th>
            <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">Passed</th>
            <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
              Pass rate
            </th>
            <th className="border-b border-slate-800 p-2" />
          </tr>
        </thead>
        <tbody>
          {visibleBuckets.map((bucket) => {
            const isActive = isRuleLevel && bucket.name === activeRule
            return (
              <tr key={bucket.name} className={isActive ? 'bg-blue-500/10' : undefined}>
                <td className="border-b border-slate-800/50 p-2 text-slate-200">
                  {isRuleLevel ? (
                    <button
                      type="button"
                      onClick={() => onRuleChange(bucket.name)}
                      className="text-left text-blue-400 hover:underline"
                    >
                      {bucket.name}
                    </button>
                  ) : (
                    bucket.name
                  )}
                </td>
                <td className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-100">
                  {bucketCountsText(bucket)}
                </td>
                <td className="border-b border-slate-800/50 p-2 text-right font-mono text-slate-100">
                  {bucketPassRateText(bucket)}
                </td>
                <td className="border-b border-slate-800/50 p-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${bucketProportionPercent(bucket)}%` }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-medium text-blue-400 hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${group.buckets.length} rules`}
        </button>
      )}
    </div>
  )
}
