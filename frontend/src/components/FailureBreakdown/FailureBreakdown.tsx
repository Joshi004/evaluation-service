import { useState } from 'react'
import type { DiagnosticsBucket, DiagnosticsInstructionLevel, DiagnosticsMetric } from '../../api/client'
import { EmptyState } from '../EmptyState/EmptyState'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
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
// family and rule breakdown tables. Plain sorted tables with the raw
// counts visible, not charts -- docs/SCORE_DRILLDOWN_UI_PLAN.md Section
// 9 says a 25-row bar chart is less readable than the list and hides
// the counts that make it checkable.
//
// Bare content, no card chrome or heading of its own (Phase 7,
// docs/UI_REDESIGN_PLAN.md §8.7): the Samples tab's own "Breakdown"
// disclosure supplies both, since that heading now doubles as the
// toggle button's own label.
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
      <EmptyState
        title="No failure breakdown"
        description="This benchmark has no natural grouping — browse the samples below instead."
      />
    )
  }

  const groups = groupBucketsByLevel(buckets)
  const noKnownOutcome = hasNoKnownOutcome(buckets)
  const microMacroNotes = buildMicroMacroNote(instructionLevel, metrics)

  return (
    <div className="space-y-4">
      {/* A recheck that failed (or a benchmark it never ran for) still
          produces buckets from `instruction_id_list` alone -- Phase 6
          says show them with per-rule detail marked unavailable rather
          than an empty table. */}
      {noKnownOutcome && (
        <p className="text-xs text-warning">
          Per-rule detail is unavailable for this run — the recheck did not produce an outcome.
          Showing which instructions exist in each bucket only.
        </p>
      )}

      {microMacroNotes.map((note) => (
        <p key={note} className="text-xs text-muted-foreground">
          {note}
        </p>
      ))}

      {activeRule !== null && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Filtering samples to <span className="font-mono text-foreground">{activeRule}</span>
          </span>
          <button type="button" onClick={() => onRuleChange(null)} className="text-primary hover:underline">
            Clear rule filter
          </button>
        </div>
      )}

      {groups.map((group) => (
        <BucketTable key={group.level} group={group} activeRule={activeRule} onRuleChange={onRuleChange} />
      ))}
    </div>
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
    <div>
      <h3 className="text-sm font-medium text-foreground">{group.label}</h3>
      <div className="mt-2">
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell className="text-right">Passed</TableHeaderCell>
              <TableHeaderCell className="text-right">Pass rate</TableHeaderCell>
              <TableHeaderCell />
            </tr>
          </thead>
          <tbody>
            {visibleBuckets.map((bucket) => {
              const isActive = isRuleLevel && bucket.name === activeRule
              return (
                <tr key={bucket.name} className={isActive ? 'bg-primary-soft' : undefined}>
                  <TableCell>
                    {isRuleLevel ? (
                      <button
                        type="button"
                        onClick={() => onRuleChange(bucket.name)}
                        className="text-left text-primary hover:underline"
                      >
                        {bucket.name}
                      </button>
                    ) : (
                      bucket.name
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {bucketCountsText(bucket)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {bucketPassRateText(bucket)}
                  </TableCell>
                  <TableCell>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${bucketProportionPercent(bucket)}%` }}
                      />
                    </div>
                  </TableCell>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${group.buckets.length} rules`}
        </button>
      )}
    </div>
  )
}
