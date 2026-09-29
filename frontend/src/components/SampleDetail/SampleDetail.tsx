import { useState } from 'react'
import type { DiagnosticsSampleDetail } from '../../api/client'
import {
  formatAnswerMeta,
  formatScores,
  outcomeLabel,
  showsGenericComparison,
} from './SampleDetail.helper'

interface SampleDetailProps {
  sample: DiagnosticsSampleDetail
}

// Layer 5's shared shell (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
// Phase 7): the prompt, the answer with its token/latency metadata,
// the collapsed thinking block, and -- only for a benchmark with no
// rule checklist -- the generic target/extracted-prediction
// comparison. Works for every benchmark in the catalog; the per-rule
// checklist itself is a separate sibling (IfevalRuleChecklist),
// rendered by the caller only when sample.rules.length > 0.
export function SampleDetail({ sample }: SampleDetailProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false)
  const text = sample.text

  if (text === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Full text is unavailable for this sample — its reviews file no longer has a matching line.
      </p>
    )
  }

  const answerMeta = formatAnswerMeta(sample)
  const hasReasoning = text.reasoning.length > 0

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className={sample.passed ? 'text-sm font-medium text-success' : 'text-sm font-medium text-danger'}>
          {outcomeLabel(sample.passed)}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{formatScores(sample.scores)}</span>
      </div>

      <section className="mt-4">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Prompt</h2>
        <p className="mt-1 rounded-lg border border-border bg-muted p-3 text-sm whitespace-pre-wrap text-foreground">
          {text.prompt}
        </p>
      </section>

      <section className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Answer</h2>
          {answerMeta !== null && <span className="text-xs text-muted-foreground">{answerMeta}</span>}
        </div>
        {/* whitespace-pre-wrap and font-mono keep a leading blank line
            visible rather than collapsed by normal HTML whitespace
            rules -- run-13 key 181's own leading "\n\n" is the reason
            this page needs to render text verbatim at all
            (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 7). */}
        <p className="mt-1 rounded-lg border border-border bg-muted p-3 font-mono text-sm whitespace-pre-wrap text-foreground">
          {text.answer}
        </p>
      </section>

      {hasReasoning && (
        <section className="mt-4">
          <button
            type="button"
            onClick={() => setReasoningExpanded((value) => !value)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {reasoningExpanded ? 'Hide thinking block' : 'Show thinking block'}
          </button>
          {reasoningExpanded && (
            <p className="mt-2 rounded-lg border border-border bg-muted p-3 text-xs whitespace-pre-wrap text-muted-foreground">
              {text.reasoning}
            </p>
          )}
        </section>
      )}

      {showsGenericComparison(sample) && (
        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Target</h2>
            <p className="mt-1 rounded-lg border border-border bg-muted p-3 text-sm whitespace-pre-wrap text-foreground">
              {text.target || '\u2014'}
            </p>
          </div>
          <div>
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Extracted prediction
            </h2>
            <p className="mt-1 rounded-lg border border-border bg-muted p-3 text-sm whitespace-pre-wrap text-foreground">
              {text.extracted_prediction || '\u2014'}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
