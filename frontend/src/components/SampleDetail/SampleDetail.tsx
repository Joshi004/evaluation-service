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
// rendered by the page only when sample.rules.length > 0.
export function SampleDetail({ sample }: SampleDetailProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false)
  const text = sample.text

  if (text === null) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        Full text is unavailable for this sample — its reviews file no longer has a matching line.
      </p>
    )
  }

  const answerMeta = formatAnswerMeta(sample)
  const hasReasoning = text.reasoning.length > 0

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className={sample.passed ? 'text-sm font-medium text-emerald-400' : 'text-sm font-medium text-red-400'}>
          {outcomeLabel(sample.passed)}
        </span>
        <span className="font-mono text-xs text-slate-400">{formatScores(sample.scores)}</span>
      </div>

      <section className="mt-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Prompt</h2>
        <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-200">
          {text.prompt}
        </p>
      </section>

      <section className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Answer</h2>
          {answerMeta !== null && <span className="text-xs text-slate-500">{answerMeta}</span>}
        </div>
        {/* whitespace-pre-wrap and font-mono keep a leading blank line
            visible rather than collapsed by normal HTML whitespace
            rules -- run-13 key 181's own leading "\n\n" is the reason
            this page needs to render text verbatim at all
            (docs/SCORE_DRILLDOWN_UI_PLAN.md Section 7). */}
        <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-sm text-slate-100">
          {text.answer}
        </p>
      </section>

      {hasReasoning && (
        <section className="mt-4">
          <button
            type="button"
            onClick={() => setReasoningExpanded((value) => !value)}
            className="text-xs font-medium text-blue-400 hover:underline"
          >
            {reasoningExpanded ? 'Hide thinking block' : 'Show thinking block'}
          </button>
          {reasoningExpanded && (
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
              {text.reasoning}
            </p>
          )}
        </section>
      )}

      {showsGenericComparison(sample) && (
        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Target</h2>
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-200">
              {text.target || '\u2014'}
            </p>
          </div>
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Extracted prediction
            </h2>
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-200">
              {text.extracted_prediction || '\u2014'}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
